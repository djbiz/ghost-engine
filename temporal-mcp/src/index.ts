import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Connection, Client } from "@temporalio/client";

// --- Config ---
const TEMPORAL_ADDRESS =
  process.env.TEMPORAL_ADDRESS || "ap-northeast-1.aws.api.temporal.io:7233";
const TEMPORAL_NAMESPACE =
  process.env.TEMPORAL_NAMESPACE || "quickstart-derekjami-878d5147.kydxq";
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY || "";

// --- Temporal client singleton ---
let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (_client) return _client;

  const connection = await Connection.connect({
    address: TEMPORAL_ADDRESS,
    tls: true,
    apiKey: TEMPORAL_API_KEY,
    metadata: {
      "temporal-namespace": TEMPORAL_NAMESPACE,
    },
  });

  _client = new Client({
    connection,
    namespace: TEMPORAL_NAMESPACE,
  });

  return _client;
}

// --- Tool definitions ---
const TOOLS = [
  {
    name: "temporal_start_workflow",
    description:
      "Start a new Temporal workflow execution. Returns the workflow ID and run ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowType: {
          type: "string",
          description: "The workflow type name (registered workflow function name)",
        },
        workflowId: {
          type: "string",
          description:
            "Unique workflow ID. If omitted, a UUID is generated automatically.",
        },
        taskQueue: {
          type: "string",
          description: "The task queue to route the workflow to",
        },
        args: {
          type: "array",
          description: "Array of arguments to pass to the workflow",
          items: {},
        },
        searchAttributes: {
          type: "object",
          description: "Optional search attributes for the workflow",
          additionalProperties: true,
        },
        memo: {
          type: "object",
          description: "Optional memo key-value pairs",
          additionalProperties: true,
        },
        cronSchedule: {
          type: "string",
          description: "Optional cron schedule string for recurring execution",
        },
        workflowExecutionTimeout: {
          type: "string",
          description:
            "Optional max total execution time (e.g. '30m', '24h'). Includes retries and continue-as-new.",
        },
        workflowRunTimeout: {
          type: "string",
          description:
            "Optional max single run time (e.g. '10m'). Does not include retries.",
        },
        workflowTaskTimeout: {
          type: "string",
          description:
            "Optional max time for a single workflow task (default 10s).",
        },
      },
      required: ["workflowType", "taskQueue"],
    },
  },
  {
    name: "temporal_describe_workflow",
    description:
      "Get the current status and details of a workflow execution, including state, start time, history length, pending activities, and search attributes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to describe",
        },
        runId: {
          type: "string",
          description: "Optional run ID. If omitted, describes the latest run.",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "temporal_list_workflows",
    description:
      "List workflow executions with optional filtering via a Temporal visibility query (e.g. 'ExecutionStatus=\"Running\"', 'WorkflowType=\"MyWorkflow\"').",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            'Optional visibility query filter. Examples: \'ExecutionStatus="Running"\', \'WorkflowType="OrderWorkflow" AND StartTime > "2026-04-01T00:00:00Z"\'',
        },
        pageSize: {
          type: "number",
          description: "Number of results per page (default 20, max 100)",
        },
        nextPageToken: {
          type: "string",
          description: "Pagination token from a previous list call",
        },
      },
    },
  },
  {
    name: "temporal_signal_workflow",
    description:
      "Send a signal to a running workflow execution. Signals are async messages that can trigger workflow logic.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to signal",
        },
        signalName: {
          type: "string",
          description: "The name of the signal",
        },
        args: {
          type: "array",
          description: "Arguments to pass with the signal",
          items: {},
        },
        runId: {
          type: "string",
          description: "Optional run ID. If omitted, signals the latest run.",
        },
      },
      required: ["workflowId", "signalName"],
    },
  },
  {
    name: "temporal_query_workflow",
    description:
      "Query a running workflow for its current state. Queries are synchronous and return data without affecting the workflow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to query",
        },
        queryType: {
          type: "string",
          description: "The name of the query handler",
        },
        args: {
          type: "array",
          description: "Arguments to pass with the query",
          items: {},
        },
        runId: {
          type: "string",
          description: "Optional run ID. If omitted, queries the latest run.",
        },
      },
      required: ["workflowId", "queryType"],
    },
  },
  {
    name: "temporal_terminate_workflow",
    description:
      "Terminate a running workflow execution. This is a hard stop — the workflow will not run cleanup or compensations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to terminate",
        },
        reason: {
          type: "string",
          description: "Reason for termination (recorded in history)",
        },
        runId: {
          type: "string",
          description: "Optional run ID. If omitted, terminates the latest run.",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "temporal_cancel_workflow",
    description:
      "Request cancellation of a running workflow. Unlike terminate, this allows the workflow to handle cleanup via cancellation scopes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to cancel",
        },
        runId: {
          type: "string",
          description: "Optional run ID. If omitted, cancels the latest run.",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "temporal_get_workflow_result",
    description:
      "Wait for and retrieve the final result of a workflow execution. Blocks until the workflow completes or fails.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID",
        },
        runId: {
          type: "string",
          description: "Optional run ID. If omitted, gets the latest run result.",
        },
        followRuns: {
          type: "boolean",
          description:
            "Whether to follow the chain through continue-as-new (default true).",
        },
      },
      required: ["workflowId"],
    },
  },
];

// --- Duration parser ---
function parseDuration(input: string): string {
  // Already ISO 8601 duration
  if (input.startsWith("P")) return input;
  // Shorthand like 30m, 24h, 10s
  const match = input.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return input;
  const [, value, unit] = match;
  const ms: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return `${parseInt(value) * (ms[unit] || 1)}ms`;
}

function durationToMs(input: string): number | undefined {
  if (!input) return undefined;
  const match = input.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return undefined;
  const [, value, unit] = match;
  const ms: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return parseInt(value) * (ms[unit] || 1);
}

// --- Tool handlers ---
async function handleStartWorkflow(args: Record<string, unknown>) {
  const client = await getClient();

  const options: Record<string, unknown> = {
    taskQueue: args.taskQueue as string,
    workflowId: (args.workflowId as string) || undefined,
    args: (args.args as unknown[]) || [],
  };

  if (args.searchAttributes) {
    options.searchAttributes = args.searchAttributes;
  }
  if (args.memo) {
    options.memo = args.memo;
  }
  if (args.cronSchedule) {
    options.cronSchedule = args.cronSchedule;
  }
  if (args.workflowExecutionTimeout) {
    options.workflowExecutionTimeout = durationToMs(
      args.workflowExecutionTimeout as string
    );
  }
  if (args.workflowRunTimeout) {
    options.workflowRunTimeout = durationToMs(args.workflowRunTimeout as string);
  }
  if (args.workflowTaskTimeout) {
    options.workflowTaskTimeout = durationToMs(
      args.workflowTaskTimeout as string
    );
  }

  const handle = await client.workflow.start(args.workflowType as string, {
    ...(options as any),
  });

  return {
    workflowId: handle.workflowId,
    firstExecutionRunId: handle.firstExecutionRunId,
    status: "STARTED",
  };
}

async function handleDescribeWorkflow(args: Record<string, unknown>) {
  const client = await getClient();
  const handle = client.workflow.getHandle(
    args.workflowId as string,
    args.runId as string | undefined
  );
  const desc = await handle.describe();

  return {
    workflowId: desc.workflowId,
    runId: desc.runId,
    type: desc.type,
    status: desc.status.name,
    startTime: desc.startTime?.toISOString(),
    closeTime: desc.closeTime?.toISOString(),
    executionTime: desc.executionTime?.toISOString(),
    historyLength: desc.historyLength,
    historySize: desc.historySizeBytes,
    taskQueue: desc.taskQueue,
    memo: desc.memo,
    searchAttributes: desc.searchAttributes,
    parentExecution: desc.parentExecution,
    raw: desc.raw ? {
      pendingActivitiesCount:
        desc.raw.workflowExecutionInfo?.pendingActivities?.length ?? 0,
    } : undefined,
  };
}

async function handleListWorkflows(args: Record<string, unknown>) {
  const client = await getClient();
  const pageSize = Math.min((args.pageSize as number) || 20, 100);

  const workflows: unknown[] = [];
  let count = 0;

  for await (const workflow of client.workflow.list({
    query: (args.query as string) || undefined,
  })) {
    workflows.push({
      workflowId: workflow.workflowId,
      runId: workflow.runId,
      type: workflow.type,
      status: workflow.status.name,
      startTime: workflow.startTime?.toISOString(),
      closeTime: workflow.closeTime?.toISOString(),
      taskQueue: workflow.taskQueue,
      memo: workflow.memo,
    });
    count++;
    if (count >= pageSize) break;
  }

  return {
    workflows,
    count: workflows.length,
  };
}

async function handleSignalWorkflow(args: Record<string, unknown>) {
  const client = await getClient();
  const handle = client.workflow.getHandle(
    args.workflowId as string,
    args.runId as string | undefined
  );
  await handle.signal(args.signalName as string, ...(args.args as unknown[] || []));
  return { status: "SIGNALED", workflowId: args.workflowId, signal: args.signalName };
}

async function handleQueryWorkflow(args: Record<string, unknown>) {
  const client = await getClient();
  const handle = client.workflow.getHandle(
    args.workflowId as string,
    args.runId as string | undefined
  );
  const result = await handle.query(args.queryType as string, ...(args.args as unknown[] || []));
  return { workflowId: args.workflowId, queryType: args.queryType, result };
}

async function handleTerminateWorkflow(args: Record<string, unknown>) {
  const client = await getClient();
  const handle = client.workflow.getHandle(
    args.workflowId as string,
    args.runId as string | undefined
  );
  await handle.terminate(args.reason as string | undefined);
  return { status: "TERMINATED", workflowId: args.workflowId, reason: args.reason };
}

async function handleCancelWorkflow(args: Record<string, unknown>) {
  const client = await getClient();
  const handle = client.workflow.getHandle(
    args.workflowId as string,
    args.runId as string | undefined
  );
  await handle.cancel();
  return { status: "CANCEL_REQUESTED", workflowId: args.workflowId };
}

async function handleGetWorkflowResult(args: Record<string, unknown>) {
  const client = await getClient();
  const handle = client.workflow.getHandle(
    args.workflowId as string,
    args.runId as string | undefined
  );
  const result = await handle.result();
  return { workflowId: args.workflowId, result };
}

// --- MCP Server ---
const server = new Server(
  { name: "temporal-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "temporal_start_workflow":
        result = await handleStartWorkflow(args as Record<string, unknown>);
        break;
      case "temporal_describe_workflow":
        result = await handleDescribeWorkflow(args as Record<string, unknown>);
        break;
      case "temporal_list_workflows":
        result = await handleListWorkflows(args as Record<string, unknown>);
        break;
      case "temporal_signal_workflow":
        result = await handleSignalWorkflow(args as Record<string, unknown>);
        break;
      case "temporal_query_workflow":
        result = await handleQueryWorkflow(args as Record<string, unknown>);
        break;
      case "temporal_terminate_workflow":
        result = await handleTerminateWorkflow(args as Record<string, unknown>);
        break;
      case "temporal_cancel_workflow":
        result = await handleCancelWorkflow(args as Record<string, unknown>);
        break;
      case "temporal_get_workflow_result":
        result = await handleGetWorkflowResult(args as Record<string, unknown>);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Temporal MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
