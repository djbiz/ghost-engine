#!/usr/bin/env node
/**
 * Ghost Engine - Linear Webhook Listener
 *
 * Thin HTTP server that receives Linear webhook events and starts
 * Temporal workflows. This is the only piece that stays on PM2.
 * All logic lives in Temporal activities.
 *
 * Linear webhook setup:
 *   1. Go to Linear Settings -> API -> Webhooks
 *   2. Create webhook pointing to https://<your-server>:3847/linear/webhook
 *   3. Select events: "Issue" (state changes)
 *   4. Set the signing secret as LINEAR_WEBHOOK_SECRET env var
 *
 * Env vars:
 *   LINEAR_WEBHOOK_SECRET  - webhook signing secret from Linear
 *   LINEAR_API_KEY         - Linear API key (for the activities)
 *   TEMPORAL_ADDRESS       - Temporal Cloud address
 *   TEMPORAL_NAMESPACE     - Temporal namespace
 *   TEMPORAL_API_KEY       - Temporal Cloud API key
 *   TEMPORAL_TASK_QUEUE    - task queue (default: ghost-engine-campaigns)
 *   WEBHOOK_PORT           - HTTP port (default: 3847)
 */

const http = require('http');
const crypto = require('crypto');
const { Connection, Client } = require('@temporalio/client');
const { getTemporalConfig, getTemporalConnectionOptions } = require('./config');

const PORT = parseInt(process.env.WEBHOOK_PORT || '3847', 10);
const WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET || '';

// GHO team key - only process issues from this team
const TARGET_TEAM_KEY = 'GHO';

let temporalClient = null;

async function getTemporalClient() {
  if (temporalClient) return temporalClient;

  const config = getTemporalConfig();
  const connection = await Connection.connect(
    getTemporalConnectionOptions(config),
  );

  temporalClient = new Client({
    connection,
    namespace: config.namespace,
  });

  return temporalClient;
}

function verifySignature(body, signature) {
  if (!WEBHOOK_SECRET) {
    console.warn('[webhook] LINEAR_WEBHOOK_SECRET not set - skipping signature verification');
    return true;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(body);
  const expected = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature || '', 'utf8'),
    Buffer.from(expected, 'utf8'),
  );
}

function extractLeadFromTitle(title) {
  // Pattern: "[OUTREACH] Company Name - email@example.com"
  const emailMatch = title.match(/[\w.-]+@[\w.-]+\.\w+/);
  const nameMatch = title.match(/\]\s*(.+?)(?:\s*-\s*[\w.-]+@|\s*$)/);

  return {
    leadEmail: emailMatch ? emailMatch[0] : null,
    leadName: nameMatch ? nameMatch[1].trim() : null,
  };
}

function parseIssueUpdate(payload) {
  const { data, type, action, updatedFrom } = payload;

  // We only care about Issue updates where the state changed
  if (type !== 'Issue' || action !== 'update') return null;
  if (!updatedFrom || !updatedFrom.stateId) return null;

  const issue = data;
  if (!issue) return null;

  // Filter to GHO team only
  const teamKey = issue.team?.key || '';
  if (teamKey !== TARGET_TEAM_KEY) return null;

  const previousStatus = updatedFrom.stateName || updatedFrom.stateId || 'unknown';
  const newStatus = issue.state?.name || 'unknown';

  // Skip if status didn't actually change
  if (previousStatus === newStatus) return null;

  const leadInfo = extractLeadFromTitle(issue.title || '');

  return {
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    issueTitle: issue.title,
    issueUrl: issue.url,
    previousStatus,
    newStatus,
    projectId: issue.project?.id || null,
    projectName: issue.project?.name || null,
    leadEmail: leadInfo.leadEmail,
    leadName: leadInfo.leadName,
    metadata: {
      teamKey,
      teamId: issue.team?.id,
      assigneeId: issue.assignee?.id,
      priority: issue.priority,
      labels: (issue.labels || []).map((l) => l.name),
      webhookReceivedAt: new Date().toISOString(),
    },
  };
}

async function startOutboundChain(input) {
  const config = getTemporalConfig();
  const client = await getTemporalClient();

  const workflowId = `outbound-chain-${input.issueIdentifier}-${Date.now()}`;

  console.log(`[webhook] Starting outboundChainWorkflow: ${workflowId}`);
  console.log(`[webhook]   Issue: ${input.issueIdentifier} "${input.issueTitle}"`);
  console.log(`[webhook]   Transition: "${input.previousStatus}" -> "${input.newStatus}"`);

  const handle = await client.workflow.start('outboundChainWorkflow', {
    taskQueue: config.taskQueue,
    workflowId,
    args: [input],
    workflowExecutionTimeout: '1 hour',
  });

  console.log(`[webhook] Workflow started: ${handle.workflowId} (runId: ${handle.firstExecutionRunId})`);

  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}

async function handleWebhook(req, res) {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'ghost-engine-linear-webhook' }));
    return;
  }

  // Only accept POST to /linear/webhook
  if (req.method !== 'POST' || req.url !== '/linear/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Read body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');

  // Verify signature
  const signature = req.headers['linear-signature'] || '';
  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    console.error('[webhook] Invalid signature - rejecting');
    res.writeHead(401);
    res.end('Invalid signature');
    return;
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('[webhook] Invalid JSON payload');
    res.writeHead(400);
    res.end('Invalid JSON');
    return;
  }

  // Respond immediately (Linear expects fast 200)
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true }));

  // Process async
  try {
    const input = parseIssueUpdate(payload);

    if (!input) {
      console.log(`[webhook] Ignored: type=${payload.type} action=${payload.action} (not an actionable GHO state change)`);
      return;
    }

    console.log(`[webhook] Actionable state change detected: ${input.issueIdentifier} "${input.previousStatus}" -> "${input.newStatus}"`);

    const result = await startOutboundChain(input);
    console.log(`[webhook] Dispatched: ${result.workflowId}`);
  } catch (err) {
    console.error('[webhook] Error processing webhook:', err.message);
    console.error(err.stack);
  }
}

async function main() {
  const server = http.createServer(handleWebhook);

  server.listen(PORT, () => {
    console.log(`[webhook] Ghost Engine Linear webhook listener running on port ${PORT}`);
    console.log(`[webhook] POST /linear/webhook -> starts outboundChainWorkflow`);
    console.log(`[webhook] GET  /health          -> health check`);
    console.log(`[webhook] Team filter: ${TARGET_TEAM_KEY}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('[webhook] Shutting down...');
    server.close(() => {
      console.log('[webhook] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[webhook] Fatal error:', err);
  process.exit(1);
});
