#!/usr/bin/env node
/**
 * Ghost Engine — Self-Optimizing DM Engine
 * Tracks every DM sent, every reply, every close.
 * Auto-promotes winners, auto-kills losers.
 */

const fs = require("fs");
const path = require("path");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const LOG = `${BASE}/dm-log.jsonl`;
const LEADS = `${BASE}/leads/crm.csv`;
const TEMPLATES = `${BASE}/scripts/dm-templates.js`;

// Thresholds
const PROMOTE_RATE = 0.15;   // 15% reply rate → promote to top performer
const KILL_RATE = 0.03;      // 3% reply rate for 3 rounds → archive
const ARCHIVE_AFTER = 3;     // rounds before archiving a dead opener

async function loadLog() {
  if (!fs.existsSync(LOG)) return [];
  return fs.readFileSync(LOG, "utf8")
    .trim().split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function saveEntry(entry) {
  fs.appendFileSync(LOG, JSON.stringify(entry) + "\n");
}

async function getStatsByOpener() {
  const log = await loadLog();
  const byOpener = {};
  for (const entry of log) {
    if (!byOpener[entry.opener]) {
      byOpener[entry.opener] = { sent: 0, replies: 0, leads: 0, closes: 0 };
    }
    byOpener[entry.opener].sent += 1;
    byOpener[entry.opener].replies += entry.reply ? 1 : 0;
    byOpener[entry.opener].leads += entry.lead || 0;
    byOpener[entry.opener].closes += entry.close || 0;
  }
  return byOpener;
}

async function logDM({ opener, lead_id, result }) {
  await saveEntry({
    ts: new Date().toISOString(),
    opener,
    lead_id,
    result, // "reply" | "no_reply" | "lead" | "close"
    reply: result === "reply" || result === "lead" || result === "close",
    lead: result === "lead" || result === "close",
    close: result === "close",
  });
}

async function report() {
  const byOpener = await getStatsByOpener();
  const ranked = Object.entries(byOpener)
    .map(([opener, s]) => ({
      opener,
      sent: s.sent,
      replies: s.replies,
      reply_rate: s.sent > 0 ? (s.replies / s.sent * 100).toFixed(1) : 0,
      leads: s.leads,
      closes: s.closes,
      close_rate: s.sent > 0 ? (s.closes / s.sent * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => parseFloat(b.reply_rate) - parseFloat(a.reply_rate));

  console.log("\n═══════════════════════════════════════");
  console.log("  DM ENGINE — PERFORMANCE RANKINGS");
  console.log("═══════════════════════════════════════");
  ranked.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
    const status = r.reply_rate >= 15 ? "📈 PROMOTE" : r.reply_rate < 3 ? "📉 KILL" : "✅ OK";
    console.log(`${medal} "${r.opener.slice(0, 50)}..."`);
    console.log(`   Sent: ${r.sent} | Replies: ${r.replies} | Rate: ${r.reply_rate}% | Closes: ${r.closes} | ${status}`);
  });
  console.log("═══════════════════════════════════════\n");

  if (ranked.length > 0 && parseFloat(ranked[0].reply_rate) >= 15) {
    console.log(`🚀 TOP OPENER: "${ranked[0].opener}" — ${ranked[0].reply_rate}% reply rate`);
    console.log("   → SCALE THIS: Use 3x more in next outreach batch\n");
  }
  if (ranked.some(r => parseFloat(r.reply_rate) < 3)) {
    const dead = ranked.filter(r => parseFloat(r.reply_rate) < 3);
    console.log(`🪦 KILL LIST (below 3%):`);
    dead.forEach(r => console.log(`   - "${r.opener.slice(0, 50)}..." — ${r.reply_rate}%`));
    console.log("   → ARCHIVE these openers. Rotate new variants.\n");
  }
}

async function suggestNext() {
  const byOpener = await getStatsByOpener();
  const ranked = Object.entries(byOpener)
    .map(([opener, s]) => ({
      opener,
      reply_rate: s.sent > 0 ? s.replies / s.sent : 0,
    }))
    .sort((a, b) => b.reply_rate - a.reply_rate);

  if (ranked.length === 0) {
    console.log("No data yet. Send some DMs first.");
    return;
  }

  console.log("\n🎯 NEXT DM — Use this opener:");
  console.log(`"${ranked[0].opener}"`);
  console.log(`   Expected reply rate: ${(ranked[0].reply_rate * 100).toFixed(1)}%\n`);
}

// CLI
const cmd = process.argv[2];
if (cmd === "report") await report();
else if (cmd === "suggest") await suggestNext();
else if (cmd === "log") {
  const opener = process.argv[3];
  const result = process.argv[4];
  if (!opener || !result) {
    console.log("Usage: node dm-engine.js log <opener_text> <reply|no_reply|lead|close>");
  } else {
    await logDM({ opener, lead_id: "manual", result });
    console.log("✅ Logged:", opener.slice(0, 40), "→", result);
  }
} else {
  console.log("Usage: node dm-engine.js [report|suggest|log <opener> <result>]");
}

module.exports = { logDM, report, suggestNext };
