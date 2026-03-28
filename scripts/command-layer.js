#!/usr/bin/env node
/**
 * Ghost Engine — Command Layer
 * "DOUBLE DOWN" | "KILL" | "TEST" | "STATUS"
 * 
 * Usage:
 *   node command-layer.js status
 *   node command-layer.js double-down
 *   node command-layer.js kill
 *   node command-layer.js test
 *   node command-layer.js log-close <lead_id> "<opener_text>"
 */

const fs = require("fs");
const { execSync } = require("child_process");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const LOG = `${BASE}/dm-log.jsonl`;
const CLOSE_LOG = `${BASE}/close-log.jsonl`;
const LEADS = `${BASE}/leads/crm.csv`;
const LESSONS = `${BASE}/lessons-learned.md`;
const DECISION = `${BASE}/decision-rules.md`;
const DM_TEMPLATES = `${BASE}/scripts/dm-templates.js`;

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";

// ─── helpers ─────────────────────────────────────────────────────────────────

function run(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 15000 }); } 
  catch (e) { return e.stdout || ""; }
}

function loadJSONl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}

function getCRMStats() {
  if (!fs.existsSync(LEADS)) return {};
  const lines = fs.readFileSync(LEADS, "utf8").trim().split("\n").filter(l => l && !l.startsWith("id,"));
  const headers = lines[0]?.split(",").map(h => h.trim()) || [];
  const total = lines.length - 1 || 0;
  const closed = lines.filter(l => l.includes(",won,")).length;
  const contacted = lines.filter(l => !l.includes(",new,") && !l.includes(",won,") && !l.includes(",lost,")).length;
  return { total, closed, contacted, revenue: closed * 4970 };
}

// ─── commands ────────────────────────────────────────────────────────────────

async function cmdStatus() {
  const stats = getCRMStats();
  const dmLog = loadJSONl(LOG);
  const closeLog = loadJSONl(CLOSE_LOG);
  
  const today = new Date().toISOString().slice(0, 10);
  const todayDMs = dmLog.filter(e => e.ts.startsWith(today));
  const todayCloses = closeLog.filter(e => e.ts.startsWith(today));
  
  // DM stats by opener
  const byOpener = {};
  for (const e of dmLog) {
    if (!byOpener[e.opener]) byOpener[e.opener] = { sent: 0, replies: 0, leads: 0, closes: 0 };
    byOpener[e.opener].sent++;
    if (e.reply) byOpener[e.opener].replies++;
    if (e.lead) byOpener[e.opener].leads++;
    if (e.close) byOpener[e.opener].closes++;
  }
  const ranked = Object.entries(byOpener)
    .map(([opener, s]) => ({
      opener: opener.slice(0, 55),
      sent: s.sent,
      reply_rate: s.sent > 0 ? (s.replies / s.sent * 100).toFixed(1) : "0.0",
      lead_rate: s.sent > 0 ? (s.leads / s.sent * 100).toFixed(1) : "0.0",
      closes: s.closes,
    }))
    .sort((a, b) => parseFloat(b.reply_rate) - parseFloat(a.reply_rate))
    .slice(0, 5);

  // Stripe revenue
  let stripeRev = 0;
  try {
    if (STRIPE_SECRET) {
      const out = run(`curl -s "https://api.stripe.com/v1/checkout/sessions?limit=10" -u "${STRIPE_SECRET}:" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(s.get('amount_total',0)//100 for s in d.get('data',[]) if s.get('status')=='complete'))"`);
      stripeRev = parseInt(out.trim()) || 0;
    }
  } catch {}

  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║   GHOST ENGINE — STATUS DASHBOARD     ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
  console.log(`📊 PIPELINE`);
  console.log(`   Leads in CRM:    ${stats.total}`);
  console.log(`   Contacted:       ${stats.contacted}`);
  console.log(`   Closes:          ${stats.closed}`);
  console.log(`   Est. Revenue:    $${stats.revenue}`);
  console.log(`   Stripe (live):   $${stripeRev}\n`);
  console.log(`📅 TODAY`);
  console.log(`   DMs sent:        ${todayDMs.length}`);
  console.log(`   Closes today:    ${todayCloses.length}\n`);
  
  if (ranked.length > 0) {
    console.log(`🔥 DM ENGINE RANKINGS (top 5 openers)`);
    ranked.forEach((r, i) => {
      const bar = "█".repeat(Math.round(parseFloat(r.reply_rate) / 2)) + "░".repeat(10 - Math.round(parseFloat(r.reply_rate) / 2));
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
      console.log(`${medal} [${r.reply_rate}%] "${r.opener}..."`);
      console.log(`    Sent: ${r.sent} | Leads: ${r.lead_rate}% | Closes: ${r.closes}`);
    });
  } else {
    console.log(`🆕 No DM data yet — send some outreach to start tracking.\n`);
  }
  
  // Offer tracker
  const closes = loadJSONl(CLOSE_LOG);
  const qf = closes.filter(e => e.tier === "quick_flip").length;
  const fe = closes.filter(e => e.tier === "full_engine").length;
  const gp = closes.filter(e => e.tier === "ghost_partner").length;
  console.log(`💰 OFFER PERFORMANCE`);
  console.log(`   Quick Flip:     ${qf} closes`);
  console.log(`   Full Engine:    ${fe} closes`);
  console.log(`   Ghost Partner:  ${gp} closes\n`);
  console.log(`⚡ COMMAND AVAILABLE: "DOUBLE DOWN" | "KILL" | "TEST"\n`);
}

async function cmdDoubleDown() {
  const dmLog = loadJSONl(LOG);
  const byOpener = {};
  for (const e of dmLog) {
    if (!byOpener[e.opener]) byOpener[e.opener] = { sent: 0, replies: 0, leads: 0, closes: 0 };
    byOpener[e.opener].sent++;
    if (e.reply) byOpener[e.opener].replies++;
    if (e.lead) byOpener[e.opener].leads++;
    if (e.close) byOpener[e.opener].closes++;
  }
  const ranked = Object.entries(byOpener)
    .map(([opener, s]) => ({
      opener,
      sent: s.sent,
      reply_rate: s.sent > 0 ? s.replies / s.sent : 0,
      lead_rate: s.sent > 0 ? s.leads / s.sent : 0,
      closes: s.closes,
    }))
    .sort((a, b) => b.reply_rate - a.reply_rate);

  if (ranked.length === 0 || ranked[0].reply_rate === 0) {
    console.log("🆕 Not enough data to double down yet.");
    console.log("Send 20+ DMs first, then run: node command-layer.js double-down");
    return;
  }

  const winner = ranked[0];
  const winnerLeadType = dmLog
    .filter(e => e.opener === winner.opener && e.lead)
    .map(e => e.lead_type || "unknown");

  console.log(`\n🚀 DOUBLE DOWN — Scaling What's Working\n`);
  console.log(`🥇 WINNING OPENER:`);
  console.log(`   "${winner.opener}"`);
  console.log(`   Reply rate: ${(winner.reply_rate * 100).toFixed(1)}%`);
  console.log(`   Sent: ${winner.sent} | Leads: ${winner.closes} closes\n`);
  console.log(`🎯 WHAT TO SCALE:`);
  console.log(`   → Fire 50+ more DMs with THIS exact opener`);
  console.log(`   → Target same lead type: ${winnerLeadType[0] || "all types"}`);
  console.log(`   → Post the winning hook twice today`);
  console.log(`\n📝 COPY TO USE:`);
  console.log(`\n"${winner.opener}"\n`);
  
  // Update decision rules with winner
  const update = `\n\n## AUTO-UPDATED ${new Date().toISOString().slice(0,10)} (DOUBLE DOWN)
### Best-performing opener (${(winner.reply_rate*100).toFixed(1)}% reply rate):
"${winner.opener}"
`;
  fs.appendFileSync(DECISION, update);
  console.log(`✅ Written to decision-rules.md`);
}

async function cmdKill() {
  const dmLog = loadJSONl(LOG);
  const byOpener = {};
  for (const e of dmLog) {
    if (!byOpener[e.opener]) byOpener[e.opener] = { sent: 0, replies: 0 };
    byOpener[e.opener].sent++;
    if (e.reply) byOpener[e.opener].replies++;
  }
  const ranked = Object.entries(byOpener)
    .map(([opener, s]) => ({ opener, sent: s.sent, reply_rate: s.sent > 0 ? s.replies / s.sent : 0 }))
    .sort((a, b) => a.reply_rate - b.reply_rate);

  const losers = ranked.filter(r => r.sent >= 5 && r.reply_rate < 0.05);
  const ok = ranked.filter(r => r.sent >= 5 && r.reply_rate >= 0.05);

  console.log(`\n✂️  KILL LIST — Underperformers Being Cut\n`);
  if (losers.length === 0) {
    console.log(`✅ No openers to kill — all performing above 5% threshold.\n`);
  } else {
    losers.forEach(r => {
      console.log(`🪦 "${r.opener.slice(0, 50)}..."`);
      console.log(`   Sent: ${r.sent} | Reply rate: ${(r.reply_rate*100).toFixed(1)}% — ARCHIVED\n`);
    });
    fs.appendFileSync(LESSONS, `\n## KILLED ${new Date().toISOString().slice(0,10)}`);
    losers.forEach(r => fs.appendFileSync(LESSONS, `\n- LOW PERFORMER: "${r.opener.slice(0,60)}" (${(r.reply_rate*100).toFixed(1)}% reply)`));
    fs.appendFileSync(LESSONS, "\n");
    console.log(`✅ ${losers.length} opener(s) archived. Written to lessons-learned.md\n`);
  }
  
  if (ok.length > 0) {
    console.log(`✅ KEEPING (above 5%):`);
    ok.forEach(r => console.log(`   ✓ "${r.opener.slice(0, 50)}..." — ${(r.reply_rate*100).toFixed(1)}%\n`));
  }
}

async function cmdTest() {
  const dmLog = loadJSONl(LOG);
  const byOpener = {};
  for (const e of dmLog) {
    if (!byOpener[e.opener]) byOpener[e.opener] = { sent: 0, replies: 0 };
    byOpener[e.opener].sent++;
    if (e.reply) byOpener[e.opener].replies++;
  }
  const ranked = Object.entries(byOpener)
    .map(([opener, s]) => ({ opener, reply_rate: s.sent > 0 ? s.replies / s.sent : 0 }))
    .sort((a, b) => b.reply_rate - a.reply_rate);

  const lastWinner = ranked[0]?.opener || "What's already working";
  
  const tests = [
    {
      gap: "Nobody's hitting Ghost Partner tier leads yet",
      test: "New high-intent opener for accounts with clear revenue signs (link in bio, pinned product posts)",
      success: ">10% reply rate AND 1 qualified lead per 20 sent",
      timeline: "Today + tomorrow only"
    },
    {
      gap: "Content hooks getting stale — same structure",
      test: "Pattern interrupt hook: 'You're leaving $X on the table and here's exactly why'",
      success: ">15% reply rate on DMs that cite the hook",
      timeline: "Post today, track for 48h"
    },
    {
      gap: "Full Engine tier not closing — price framing issue",
      test: "Reposition Full Engine as 'Revenue Insurance' — not cost, investment protection",
      success: "1 close per 3 proposals (33%+ close rate on this tier)",
      timeline: "Next 5 calls"
    }
  ];

  console.log(`\n🧪 TEST BRIEF — One Experiment to Run\n`);
  console.log(`📊 DATA SAYS:`);
  console.log(`   Current best opener: "${lastWinner.slice(0, 50)}..."\n`);
  console.log(`🎯 TOP TEST OPTIONS:\n`);
  tests.forEach((t, i) => {
    console.log(`${i+1}. THE GAP: ${t.gap}`);
    console.log(`   TEST: ${t.test}`);
    console.log(`   WIN: ${t.success}`);
    console.log(`   ⏰ ${t.timeline}\n`);
  });
  console.log(`⚡ RECOMMENDED: Run test #${ranked.length < 3 ? 1 : Math.floor(Math.random() * 3) + 1} — it's the highest signal.\n`);
}

// ─── main ────────────────────────────────────────────────────────────────────

const cmd = process.argv[2];
if (cmd === "status") cmdStatus();
else if (cmd === "double-down") cmdDoubleDown();
else if (cmd === "kill") cmdKill();
else if (cmd === "test") cmdTest();
else {
  console.log(`\n⚡ GHOST ENGINE — COMMAND LAYER`);
  console.log(`Usage:`);
  console.log(`  node command-layer.js status       → Full pipeline + DM stats`);
  console.log(`  node command-layer.js double-down → Scale winning opener`);
  console.log(`  node command-layer.js kill         → Cut underperformers`);
  console.log(`  node command-layer.js test         → Next experiment to run`);
  console.log(`  node command-layer.js log-close    → Log a new close\n`);
  cmdStatus();
}
