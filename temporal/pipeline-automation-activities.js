'use strict';

const { checkProcessed, markProcessed } = require('./idempotency-utils');

const fs = require('fs');
const path = require('path');

const STALL_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function createPipelineAutomationActivities(config) {
  const {
    pipelineCsvPath = path.resolve(__dirname, '../data/pipeline.csv'),
    reportsDir = path.resolve(__dirname, '../data/pipeline-reports'),
  } = config || {};

  async function runPipelineAutomation(input) {
    const { runId, date, hour } = input;

    // Idempotency guard – skip if this runId was already processed
    var alreadyProcessed = await checkProcessed(runId);
    if (alreadyProcessed) {
      console.log('[PipelineAutomation] Skipping already-processed runId: ' + runId);
      return alreadyProcessed;
    }
    const now = Date.now();

    if (!fs.existsSync(pipelineCsvPath)) {
      throw new Error('Pipeline CSV not found at ' + pipelineCsvPath);
    }
    const lines = fs.readFileSync(pipelineCsvPath, 'utf-8').trim().split('\n');
    if (lines.length < 2) throw new Error('Pipeline CSV is empty');

    const headers = lines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
    const rows = lines.slice(1).map(function (line) {
      var vals = line.split(',');
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = (vals[i] || '').trim(); });
      return obj;
    });

    // Validate required fields
    var requiredFields = ['lead_id', 'name', 'email', 'stage', 'last_activity'];
    var validationErrors = [];
    rows.forEach(function (r, i) {
      requiredFields.forEach(function (f) {
        if (!r[f]) validationErrors.push('Row ' + (i + 2) + ': missing ' + f);
      });
    });

    // Detect stalled leads (stuck >48h in a stage)
    var stalledLeads = rows.filter(function (r) {
      if (!r.last_activity) return false;
      return (now - new Date(r.last_activity).getTime()) > STALL_THRESHOLD_MS;
    }).map(function (r) {
      return {
        lead_id: r.lead_id, name: r.name, stage: r.stage,
        last_activity: r.last_activity,
        stalledHours: Math.round((now - new Date(r.last_activity).getTime()) / 3600000),
      };
    });

    // Stage-to-stage conversion rates
    var stageCounts = {};
    rows.forEach(function (r) { stageCounts[r.stage] = (stageCounts[r.stage] || 0) + 1; });
    var stages = Object.keys(stageCounts);
    var conversionRates = {};
    for (var i = 1; i < stages.length; i++) {
      conversionRates[stages[i - 1] + ' -> ' + stages[i]] =
        Math.round((stageCounts[stages[i]] / (stageCounts[stages[i - 1]] || 1)) * 100) / 100;
    }

    // Flag anomalies
    var anomalies = [];
    var total = rows.length;
    Object.keys(stageCounts).forEach(function (s) {
      if (stageCounts[s] / total > 0.5) anomalies.push(s + ' has ' + Math.round(stageCounts[s] / total * 100) + '% of leads');
    });
    if (stalledLeads.length / total > 0.3) {
      anomalies.push(Math.round(stalledLeads.length / total * 100) + '% of leads are stalled');
    }

    // Generate health report
    var report = {
      runId: runId, date: date, hour: hour,
      generatedAt: new Date().toISOString(),
      totalLeads: total,
      stalledLeads: { count: stalledLeads.length, leads: stalledLeads },
      validationErrors: { count: validationErrors.length, errors: validationErrors.slice(0, 20) },
      stageCounts: stageCounts,
      conversionRates: conversionRates,
      anomalies: anomalies,
    };

    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    var reportPath = path.join(reportsDir, 'pipeline-report-' + date + '-' + hour + '.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('[PipelineAutomation] Report written: ' + reportPath);

    // Mark this runId as processed for idempotency
    await markProcessed(runId, report);

    return report;
  }

  return { runPipelineAutomation: runPipelineAutomation };
}

module.exports = { createPipelineAutomationActivities: createPipelineAutomationActivities };
