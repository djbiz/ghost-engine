#!/usr/bin/env node
/**
 * Ghost Engine — Airtable Formula Monitor
 * Verifies that formula fields (CFO Score, Reply Rate) exist and have
 * type "formula" in both target tables.
 *
 * Run this daily (e.g., via cron or Zo's heartbeat).
 * Add to Zo's heartbeat schedule.
 *
 * Requires env vars:
 *   AIRTABLE_API_KEY   — Airtable personal access token
 *   AIRTABLE_BASE_ID   — Airtable base ID (starts with "app")
 *
 * Usage: node airtable-formula-monitor.js
 */

const https = require("https");
const fs = require("fs");

const LOG_PATH = __dirname + "/airtable-monitor.log";

const TARGET_TABLES = [
  "Ghost Engine — Leads",
  "Ghost Engine — Weekly CFO Report"
];

const REQUIRED_FORMULA_FIELDS = [
  "CFO Score",
  "Reply Rate"
];

// ── Env var checks ──────────────────────────────────────────────────

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY) {
  console.error("❌ Missing env var: AIRTABLE_API_KEY");
  process.exit(1);
}
if (!BASE_ID) {
  console.error("❌ Missing env var: AIRTABLE_BASE_ID");
  process.exit(1);
}

// ── Airtable Metadata API ───────────────────────────────────────────

const fetchTables = () => new Promise((resolve, reject) => {
  const options = {
    hostname: "api.airtable.com",
    path: `/v0/meta/bases/${BASE_ID}/tables`,
    method: "GET",
    headers: {
      "Authorization": `Bearer ${API_KEY}`
    }
  };

  const req = https.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => {
      if (res.statusCode !== 200) {
        reject(new Error(`Airtable API returned ${res.statusCode}: ${body}`));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Failed to parse Airtable response: " + e.message));
      }
    });
  });

  req.on("error", reject);
  req.end();
});

// ── Check logic ─────────────────────────────────────────────────────

const run = async () => {
  const data = await fetchTables();
  const tables = data.tables || [];
  const issues = [];

  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   GHOST ENGINE — AIRTABLE MONITOR       ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  TARGET_TABLES.forEach((tableName) => {
    const table = tables.find((t) => t.name === tableName);

    console.log("📊 " + tableName);

    if (!table) {
      REQUIRED_FORMULA_FIELDS.forEach((fieldName) => {
        const msg = tableName + ": " + fieldName + " missing (table not found)";
        issues.push(msg);
        console.log("   ❌ " + fieldName + " — MISSING (table not found)");
      });
      console.log("");
      return;
    }

    const fields = table.fields || [];

    REQUIRED_FORMULA_FIELDS.forEach((fieldName) => {
      const field = fields.find((f) => f.name === fieldName);

      if (!field) {
        const msg = tableName + ": " + fieldName + " missing";
        issues.push(msg);
        console.log("   ❌ " + fieldName + " — MISSING (required formula field)");
      } else if (field.type !== "formula") {
        const msg = tableName + ": " + fieldName + " has type \"" + field.type + "\" (expected \"formula\")";
        issues.push(msg);
        console.log("   ❌ " + fieldName + " — WRONG TYPE: \"" + field.type + "\" (expected \"formula\")");
      } else {
        console.log("   ✅ " + fieldName + " — formula field present");
      }
    });

    console.log("");
  });

  // ── Summary ─────────────────────────────────────────────────────

  const status = issues.length === 0 ? "OK" : "FAIL";

  if (issues.length > 0) {
    console.log("⚠️  " + issues.length + " issue" + (issues.length > 1 ? "s" : "") + " found. Fix required in Airtable UI.");
  } else {
    console.log("✅ All formula fields verified. Status: OK");
  }

  console.log("");

  // ── Log to file ─────────────────────────────────────────────────

  const logEntry = JSON.stringify({
    ts: new Date().toISOString(),
    status,
    issues
  });

  fs.appendFileSync(LOG_PATH, logEntry + "\n", "utf8");

  // ── Exit code ───────────────────────────────────────────────────

  process.exit(issues.length > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error("❌ Fatal error: " + err.message);

  const logEntry = JSON.stringify({
    ts: new Date().toISOString(),
    status: "FAIL",
    issues: ["Fatal: " + err.message]
  });
  fs.appendFileSync(LOG_PATH, logEntry + "\n", "utf8");

  process.exit(1);
});
