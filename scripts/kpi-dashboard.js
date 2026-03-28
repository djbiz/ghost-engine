#!/usr/bin/env node
/**
 * Ghost Engine - KPI Dashboard
 * Real-time view of the empire machine
 * Run: node kpi-dashboard.js [report|plan|what-needs-to-happen]
 */

const fs = require("fs");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const INBOUND = BASE + "/leads/inbound.csv";
const CRM = BASE + "/leads/crm.csv";
const DISCOVERY = BASE + "/leads/discovery-calls.csv";
const CLOSE_LOG = BASE + "/scripts/close-log.jsonl";
const LESSONS = BASE + "/lessons-learned.md";

const TARGETS = {
  daily_dms: 50,
  daily_replies: 15,
  daily_bookings: 5,
  weekly_closes: 3,
  monthly_revenue: 50000
};

function readCSV(path) {
  if (!fs.existsSync(path)) return [];
  const raw = fs.readFileSync(path, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = vals[i] ? vals[i].trim() : ""; });
    return obj;
  });
}

function countStatus(csvPath) {
  const leads = readCSV(csvPath);
  const counts = {};
  leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
  return counts;
}

function revenueFromCloses() {
  const TIER_REVENUE = { quick_flip: 990, full_engine: 4970, ghost_partner: 9700, elite_partner: 15000 };
  if (!fs.existsSync(CLOSE_LOG)) return { total: 0, count: 0, breakdown: {} };
  const lines = fs.readFileSync(CLOSE_LOG, "utf8").trim().split("\n").filter(Boolean);
  let total = 0, count = 0, breakdown = {};
  lines.forEach(line => {
    try {
      const e = JSON.parse(line);
      const tier = e.tier || "quick_flip";
      const rev = TIER_REVENUE[tier] || 0;
      if (e.closed !== "false" && e.type === "close_recorded") {
        total += rev; count++; breakdown[tier] = (breakdown[tier] || 0) + 1;
      }
    } catch {}
  });
  return { total, count, breakdown };
}

function weeklyRevenue() {
  if (!fs.existsSync(CLOSE_LOG)) return { total: 0, closes: 0 };
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const TIER_REVENUE = { quick_flip: 990, full_engine: 4970, ghost_partner: 9700, elite_partner: 15000 };
  const lines = fs.readFileSync(CLOSE_LOG, "utf8").trim().split("\n").filter(Boolean);
  let total = 0, closes = 0;
  lines.forEach(line => {
    try {
      const e = JSON.parse(line);
      if (new Date(e.ts).getTime() > oneWeekAgo && e.type === "close_recorded") {
        total += TIER_REVENUE[e.tier] || 0;
        closes++;
      }
    } catch {}
  });
  return { total, closes };
}

function showReport() {
  const inbound = countStatus(INBOUND);
  const crm = countStatus(CRM);
  const discovery = readCSV(DISCOVERY);
  const { total: lifetime, count: lifetimeCloses, breakdown } = revenueFromCloses();
  const { total: weekly, closes: weeklyCloses } = weeklyRevenue();

  const monthlyTarget = TARGETS.monthly_revenue;
  const pctOfTarget = Math.round((lifetime / monthlyTarget) * 100);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   GHOST ENGINE — KPI DASHBOARD          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("💰 REVENUE");
  console.log("   Lifetime:  $" + lifetime.toLocaleString() + " (" + lifetimeCloses + " closes)");
  console.log("   This week: $" + weekly.toLocaleString() + " (" + weeklyCloses + " closes)");
  console.log("   Monthly target: $" + monthlyTarget.toLocaleString() + " | " + pctOfTarget + "% of target");
  console.log("");
  console.log("📊 PIPELINE");
  console.log("   New leads:    " + (inbound.new || 0));
  console.log("   Contacted:    " + (inbound.contacted || 0));
  console.log("   Qualified:   " + (crm.qualified || 0));
  console.log("   Proposal:     " + (crm.proposal || 0));
  console.log("   Discovery:    " + discovery.filter(d => d.status === "booked").length + " calls booked");
  console.log("");
  console.log("📋 TIER BREAKDOWN");
  Object.entries(breakdown).forEach(([tier, count]) => {
    const rev = { quick_flip: "$990", full_engine: "$4,970", ghost_partner: "$9,700", elite_partner: "$15K+" }[tier] || "$?";
    console.log("   " + tier + ": " + count + " @ " + rev);
  });
  console.log("");
  console.log("🎯 WHAT IT TAKES TO HIT $50K THIS MONTH");
  const needed = monthlyTarget - lifetime;
  const avgDeal = lifetimeCloses > 0 ? Math.round(lifetime / lifetimeCloses) : 4970;
  const remaining = Math.ceil(needed / avgDeal);
  console.log("   Need: $" + needed.toLocaleString() + " more");
  console.log("   Avg deal: $" + avgDeal.toLocaleString());
  console.log("   Closes needed: " + remaining + " more");
  console.log("   Weeks left: ~" + Math.ceil(remaining / 3) + " at current close rate");
}

function showPlan() {
  const { total: weekly, closes } = weeklyRevenue();
  const neededThisWeek = 12500;
  const gap = neededThisWeek - weekly;

  console.log("\n⚡ THIS WEEK'S PLAN");
  console.log("   Target:  $" + neededThisWeek.toLocaleString() + " | Currently: $" + weekly.toLocaleString() + " | Gap: $" + gap.toLocaleString());
  console.log("");
  console.log("   CLOSES NEEDED: " + Math.ceil(gap / 4970) + " Full Engine closes");
  console.log("   Or: " + Math.ceil(gap / 990) + " Quick Flips");
  console.log("   Or: mix of both");
  console.log("");
  console.log("   THIS WEEK:");
  console.log("   - Send 50-100 more DMs");
  console.log("   - Book 5+ discovery calls");
  console.log("   - Close 1-2 deals");
  console.log("   - Post 2-3 authority posts with proof");
  console.log("");
  console.log("   SCALE LEVERS:");
  console.log("   1. If close rate > 30% -> double ad spend");
  console.log("   2. If CPL < $50 -> increase budget");
  console.log("   3. If 0 closes in 3 days -> new DM angle");
  console.log("   4. If 5+ hot leads -> Derek takes calls");
}

function showWhatNeedsToHappen() {
  const { total: lifetime } = revenueFromCloses();
  const inbound = countStatus(INBOUND);
  const crm = countStatus(CRM);
  const discovery = readCSV(DISCOVERY);

  console.log("\n🔴 RIGHT NOW, DO THIS:");
  console.log("");
  if (lifetime < 5000) {
    console.log("   1. SEND 20 DMs TODAY -- use best opener from dm-templates.js");
    console.log("   2. Book 1 discovery call this week");
    console.log("   3. Close 1 Quick Flip ($990)");
  } else if (lifetime < 20000) {
    console.log("   1. Send 30-50 DMs per day");
    console.log("   2. Book 3 discovery calls this week");
    console.log("   3. Close 1 Full Engine ($4,970)");
    console.log("   4. Post 1 case study / authority post");
  } else {
    console.log("   1. Scale what is working -- double down on best DM angle");
    console.log("   2. Increase ad spend by 50%");
    console.log("   3. Push Ghost Partner tier to warm leads");
    console.log("   4. Post 3x proof content this week");
  }
  console.log("");
  console.log("📊 FUNNEL HEALTH:");
  console.log("   Pipeline: " + ((inbound.new || 0) + (crm.qualified || 0)) + " leads");
  console.log("   Active discovery calls: " + discovery.filter(d => d.status === "booked").length);
  console.log("");
  console.log("🧠 ZO INSIGHT:");
  console.log("   Run: node command-layer.js double-down");
  console.log("   Run: node close-rate-engine.js test revenue_mirror");
  console.log("   Run: node proof-loop.js list");
}

const cmd = process.argv[2];
if (cmd === "report") {
  showReport();
} else if (cmd === "plan") {
  showPlan();
} else if (cmd === "what-needs-to-happen") {
  showWhatNeedsToHappen();
} else {
  showReport();
  console.log("");
  showPlan();
  console.log("");
  showWhatNeedsToHappen();
}
