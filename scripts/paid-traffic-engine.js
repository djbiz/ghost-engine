#!/usr/bin/env node
/**
 * Ghost Engine - Paid Traffic Engine
 * Multi-platform ad management + budget scaling
 * Run: node paid-traffic-engine.js [platform] [action]
 */

const fs = require("fs");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const ADS_DIR = BASE + "/ads";
const PROOF_DIR = BASE + "/proof";

if (!fs.existsSync(ADS_DIR)) fs.mkdirSync(ADS_DIR, { recursive: true });
if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });

const PLATFORMS = {
  tiktok: { name: "TikTok", cpl_estimate: "$25-50", angles: ["views_dont_pay", "monetize_now", "creator_gap"] },
  instagram: { name: "Instagram", cpl_estimate: "$30-60", angles: ["attention_to_revenue", "followers_to_customers"] },
  facebook: { name: "Facebook", cpl_estimate: "$20-40", angles: ["monetization_gap", "authority_proof", "scarcity"] },
  linkedin: { name: "LinkedIn", cpl_estimate: "$50-100", angles: ["founder_monetization", "audience_revenue", "ghost_partner"] },
  youtube: { name: "YouTube", cpl_estimate: "$30-60", angles: ["creator_monetization", "ad_revenue_gap"] }
};

const ANGLES = {
  views_dont_pay: {
    hook: "Views dont pay your bills.",
    body: "Most creators are sitting on audiences worth real money. They just dont have the system to extract it.",
    cta: "Book a 15-min call. Lets map it out."
  },
  monetization_gap: {
    hook: "You have attention. You dont have revenue.",
    body: "Thousands of followers but zero monthly revenue is a system problem, not a content problem.",
    cta: "15 minutes. I show you exactly how to fix it."
  },
  authority_proof: {
    hook: "Ive monetized 100+ creators. Heres what I learned.",
    body: "The creators who win dont have more followers. They have a monetization engine installed.",
    cta: "Want to see how it works? 15 min."
  },
  scarcity: {
    hook: "Only 5 Quick Flips left this week.",
    body: "48-hour monetization system. No fluff. No ongoing commitments.",
    cta: "Book now before it fills up."
  },
  creator_gap: {
    hook: "Your engagement is real. Your bank account doesnt match.",
    body: "I install the money system while you keep creating.",
    cta: "DM me. Lets talk."
  },
  founder_monetization: {
    hook: "Building in public is smart. Monetizing it is smarter.",
    body: "I help founders turn their audience into a revenue engine.",
    cta: "15 min. No pitch. Just strategy."
  },
  attention_to_revenue: {
    hook: "Attention is currency. Most creators never cash in.",
    body: "I show creators exactly how to turn followers into consistent monthly revenue.",
    cta: "Book a free strategy call."
  },
  ad_revenue_gap: {
    hook: "YouTube pays you chump change. Heres the real play.",
    body: "Ad revenue is the floor, not the ceiling. Theres a whole monetization engine youre not using.",
    cta: "Want to see it? 15 minutes."
  }
};

const FUNNEL = {
  cold: { step: "VSL", options: ["15sec hook video", "2min presentation"] },
  warm: { step: "Booking", options: ["Calendly / ghost-engine/book"] },
  hot: { step: "SMS Alert", options: ["Hot lead -> Closer agent"] },
  close: { step: "Stripe", options: ["Quick Flip $990", "Full Engine $4,970", "Ghost Partner $9,700"] },
  proof: { step: "Case Study", options: ["Auto-generate -> content -> ads"] }
};

function initPlatform(p) {
  const platform = PLATFORMS[p];
  if (!platform) { console.log("Unknown platform: " + p); return; }
  const dir = ADS_DIR + "/" + p;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  platform.angles.forEach(angle => {
    const data = { platform: p, angle, status: "paused", budget: 0, spend: 0, results: [], created: new Date().toISOString() };
    fs.writeFileSync(dir + "/" + angle + ".json", JSON.stringify(data, null, 2));
  });
  console.log("Initialized " + p + " with angles: " + platform.angles.join(", "));
}

function launchAngle(p, angle, budget) {
  const f = ADS_DIR + "/" + p + "/" + angle + ".json";
  if (!fs.existsSync(f)) { console.log("Angle not found. Run init first."); return; }
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  data.status = "live";
  data.budget = budget;
  data.launched = new Date().toISOString();
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
  console.log("[LIVE] " + p + "/" + angle + " @ $" + budget + "/day");
  console.log("Hook: " + (ANGLES[angle] ? ANGLES[angle].hook : "N/A"));
}

function killAngle(p, angle) {
  const f = ADS_DIR + "/" + p + "/" + angle + ".json";
  if (!fs.existsSync(f)) { console.log("Angle not found."); return; }
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  data.status = "paused";
  data.ended = new Date().toISOString();
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
  console.log("[PAUSED] " + p + "/" + angle);
}

function showAngle(p, angle) {
  if (!angle) { console.log("Usage: test <platform> <angle>"); return; }
  const a = ANGLES[angle];
  if (!a) { console.log("Unknown angle: " + angle); return; }
  console.log("[" + p + "] " + angle);
  console.log("HOOK: " + a.hook);
  console.log("BODY: " + a.body);
  console.log("CTA: " + a.cta);
}

function scaleBudget(p, amount) {
  const dir = ADS_DIR + "/" + p;
  if (!fs.existsSync(dir)) { console.log("Platform not initialized: " + p); return; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  let scaled = 0;
  files.forEach(f => {
    const data = JSON.parse(fs.readFileSync(dir + "/" + f, "utf8"));
    if (data.status === "live") {
      data.budget += amount;
      fs.writeFileSync(dir + "/" + f, JSON.stringify(data, null, 2));
      scaled++;
    }
  });
  console.log("[SCALED] +$" + amount + "/day to " + scaled + " live angles on " + p);
}

function showReport() {
  console.log("\n===== PAID TRAFFIC REPORT =====");
  if (!fs.existsSync(ADS_DIR)) { console.log("No ads initialized."); return; }
  const platforms = fs.readdirSync(ADS_DIR).filter(f => fs.statSync(ADS_DIR + "/" + f).isDirectory());
  let totalSpend = 0, totalLive = 0;
  platforms.forEach(p => {
    const files = fs.readdirSync(ADS_DIR + "/" + p).filter(f => f.endsWith(".json"));
    let live = 0, spend = 0;
    files.forEach(f => {
      const d = JSON.parse(fs.readFileSync(ADS_DIR + "/" + p + "/" + f, "utf8"));
      if (d.status === "live") { live++; totalLive++; }
      spend += d.spend || 0;
      totalSpend += d.spend || 0;
    });
    console.log(p + ": " + live + " live | $" + spend + " spent");
  });
  console.log("TOTAL: " + totalLive + " live | $" + totalSpend + " spent");
  console.log("\nFUNNEL:");
  Object.entries(FUNNEL).forEach(([k, v]) => console.log("  " + k + " -> " + v.step));
}

const cmd = process.argv[2];
const p = process.argv[3];
const angle = process.argv[4];
const budget = parseInt(process.argv[5]) || 500;

switch (cmd) {
  case "init": initPlatform(p); break;
  case "launch": launchAngle(p, angle, budget); break;
  case "test": showAngle(p, angle); break;
  case "scale": scaleBudget(p, budget); break;
  case "kill": killAngle(p, angle); break;
  case "report": showReport(); break;
  case "funnel":
    console.log("===== GHOST ENGINE FUNNEL =====");
    Object.entries(FUNNEL).forEach(([k, v]) => {
      console.log(k.toUpperCase() + ": " + v.step);
      v.options.forEach(o => console.log("  - " + o));
    });
    break;
  default:
    console.log("Usage:");
    console.log("  node paid-traffic-engine.js init <platform>");
    console.log("  node paid-traffic-engine.js launch <platform> <angle> [budget]");
    console.log("  node paid-traffic-engine.js test <platform> <angle>");
    console.log("  node paid-traffic-engine.js scale <platform> <amount>");
    console.log("  node paid-traffic-engine.js kill <platform> <angle>");
    console.log("  node paid-traffic-engine.js report");
    console.log("  node paid-traffic-engine.js funnel");
}
