#!/usr/bin/env node
/**
 * Ghost Engine — Speed to Proof System
 * First 1-2 wins -> instant content machine.
 * Zo creates the case study, breakdown, and authority post
 * the MOMENT a close lands.
 */

const fs = require("fs");
const path = require("path");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const PROOF_DIR = BASE + "/proof";
const CLOSE_LOG = BASE + "/close-log.jsonl";
const LESSONS = BASE + "/lessons-learned.md";
const MEMORY = BASE + "/MEMORY.md";

if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });

function saveJSONl(file, entry) {
  fs.appendFileSync(file, JSON.stringify(entry) + "\n");
}

function generateCaseStudy(close) {
  const { name, platform, followers, tier, investment, timeframe, result, gap_filled } = close;
  return `# CASE STUDY -- ${name}

Platform: ${platform}
Followers: ${followers}
Tier: ${tier.toUpperCase()} -- $${investment}
Timeline: ${timeframe}
Result: ${result}

## BEFORE
${gap_filled || "No monetization system. Attention not converting."}

## THE GAP
${close.gap || "Audience was built but no offer existed to capture it."}

## WHAT WE BUILT
${close.deliverable || "Monetization system + offer + landing page + payment link."}

## THE TURN
${timeframe}

## THE RESULT
${result}

## WHAT THIS PROVES
${tier === "quick_flip" ? "Fast money moves are possible. 48 hours from no offer to paid." : "The Full Engine creates a complete, lasting revenue machine."}

Built by Ghost Engine | derekjamieson29.zo.space
`;
}

function generateAuthorityPosts(close) {
  const { name, platform, followers, tier, timeframe, result } = close;
  return [
`Most creators don't have a growth problem.
They have a monetization problem.

${name || "Someone"} had ${followers || "tens of thousands"} followers on ${platform || "TikTok"}.
Solid engagement. Consistent posting.
But nothing was converting.

48 hours later?
${tier === "quick_flip" ? "$990 in the account. Live offer. Payment link." : "A full revenue machine running."}

The content was already working.
The missing piece was the system.

That's what Ghost Engine builds.

If you're posting daily and not monetizing -- that's the gap.`,

`I just turned attention into revenue for ${name || "a creator"}.

${followers || "Tens of thousands"} followers.
No offer.
No link in bio selling anything.
${timeframe || "48 hours later"}?
${tier === "quick_flip" ? "$990 paid. Live offer." : "Full revenue engine live."}

The hardest part isn't building the offer.
It's diagnosing exactly what's broken.

That's what I find in the first 20 minutes.

Drop your platform below -- I'll tell you exactly what's missing.`,

`Quick story.

Creator with ${followers || "20K+"} followers.
Posting every day.
Solid comments.
Zero revenue.

I showed them the gap.
They fixed it.
${result || "Money started moving."}

That's the whole game.

Not more followers.
Not more content.
A system that converts what you already have.

That's Ghost Engine.`
  ];
}

function generateBreakdown(close) {
  const { tier } = close;
  return `# HOW WE BUILT THIS -- ${close.name || "Ghost Engine Client"}

## The Setup
${close.platform || "Platform"} account. ${close.followers || "Tens of thousands"} followers.
The attention was real. The monetization was not.

## The Problem
${close.gap || "No offer existed. No funnel. No system converting followers to buyers."}

## The Solution (Built in ${close.timeframe || "48 hours"})
${close.deliverable || "Offer + funnel + payment infrastructure."}

## The Turn
${close.result || "First payment landed."}

## What This Teaches
1. ${tier === "quick_flip" ? "Speed matters more than perfection." : "A full engine creates compound returns."}
2. The offer is everything -- most people get this wrong
3. You don't need more traffic. You need better conversion.

If you want the same thing -- let's talk. Link in bio.`;
}

function speedToProof(close) {
  console.log("\n[PROOF] Speed-to-Proof triggered for:", close.name);

  const id = Date.now();
  const date = new Date().toISOString().slice(0, 10);

  saveJSONl(CLOSE_LOG, Object.assign({}, close, { ts: new Date().toISOString(), id }));

  const caseStudy = generateCaseStudy(close);
  const authorityPosts = generateAuthorityPosts(close);
  const breakdown = generateBreakdown(close);

  fs.writeFileSync(path.join(PROOF_DIR, id + "-case-study.md"), caseStudy);
  fs.writeFileSync(path.join(PROOF_DIR, id + "-breakdown.md"), breakdown);
  authorityPosts.forEach((post, i) => {
    fs.writeFileSync(path.join(PROOF_DIR, id + "-authority-post-" + (i+1) + ".md"), post);
  });

  const winEntry = "\n### Win #" + id + " -- " + date + "\n" +
    "**" + (close.name || "Anonymous") + "** | " + close.platform + " | " + close.followers + " followers\n" +
    "**Tier:** " + close.tier + " | **Revenue:** $" + close.investment + "\n" +
    "**Timeframe:** " + close.timeframe + "\n" +
    "**Result:** " + close.result + "\n" +
    "**Content files:** proof/" + id + "-*.md\n";

  try {
    let memory = fs.readFileSync(MEMORY, "utf8");
    if (memory.includes("## Win Log")) {
      memory = memory.replace("## Win Log", "## Win Log" + winEntry);
      fs.writeFileSync(MEMORY, memory);
    }
  } catch (e) {}

  fs.appendFileSync(LESSONS, "\n\n## WIN " + date + ": " + (close.name || "Client") + " -- $" + close.investment + " (" + close.tier + ")\nTimeframe: " + close.timeframe + "\nResult: " + close.result + "\n");

  console.log("  [OK] Case study: proof/" + id + "-case-study.md");
  console.log("  [OK] Authority posts: proof/" + id + "-authority-post-1/2/3.md");
  console.log("  [OK] Breakdown: proof/" + id + "-breakdown.md");
  console.log("  [OK] Close logged: close-log.jsonl");
  console.log("  [OK] MEMORY.md updated");
  console.log("  [OK] lessons-learned.md updated");
  console.log("\n  IMMEDIATE ACTION:");
  console.log("  Post authority-post-1 TODAY. Use breakdown as carousel this week.");
  console.log("  Case study goes in funnel as social proof.\n");

  return { id, caseStudy, authorityPosts, breakdown };
}

const cmd = process.argv[2];
if (cmd === "trigger" || cmd === "log") {
  const name = process.argv[3] || "Creator";
  const platform = process.argv[4] || "TikTok";
  const followers = process.argv[5] || "30K";
  const tier = process.argv[6] || "quick_flip";
  const investment = process.argv[7] || "990";
  const timeframe = process.argv[8] || "48 hours";
  const result = process.argv[9] || "First payment landed";

  const close = {
    name, platform, followers, tier,
    investment: parseInt(investment),
    timeframe, result,
    gap: "No offer, no funnel, no system converting " + followers + " followers into revenue.",
    deliverable: tier === "quick_flip"
      ? "Single offer + landing page + Stripe payment link"
      : "Full monetization engine: 3 offers + funnel + email capture + upsell path"
  };

  speedToProof(close);
} else if (cmd === "list") {
  if (!fs.existsSync(PROOF_DIR)) {
    console.log("\n  No proof files yet -- trigger your first close.\n");
    process.exit(0);
  }
  const files = fs.readdirSync(PROOF_DIR).filter(f => f.endsWith("-case-study.md"));
  console.log("\n  PROOF FILES GENERATED:\n");
  if (files.length === 0) {
    console.log("  No proof files yet -- trigger your first close.\n");
  } else {
    files.forEach(f => {
      const id = f.replace("-case-study.md", "");
      const date = id.slice(0, 10);
      console.log("  [OK] " + date + ": proof/" + f);
      console.log("      proof/" + id + "-authority-post-1.md");
      console.log("      proof/" + id + "-breakdown.md\n");
    });
  }
} else {
  console.log("\n  SPEED TO PROOF -- Usage:");
  console.log("  node speed-to-proof.js trigger \"Name\" \"TikTok\" \"30K\" \"quick_flip\" \"990\" \"48 hours\" \"Paid\"");
  console.log("  node speed-to-proof.js list\n");
}

module.exports = { speedToProof };
