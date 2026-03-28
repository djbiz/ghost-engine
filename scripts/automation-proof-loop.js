#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Proof Loop Generator
 * When a win lands → auto-generate 3 posts, 2 ads, 1 case study
 *
 * Trigger: new client entry in clients/active.csv
 * Usage: node automation-proof-loop.js
 */

const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "..");
const CLIENTS_FILE = path.join(BASE, "clients", "active.csv");
const ARCHIVE_FILE = path.join(BASE, "clients", "archived.csv");
const PROOF_OUT = path.join(BASE, "assets", "proof-loop.md");

// ─── MAIN ────────────────────────────────────────────────────────────────────

function parseCSV(filepath) {
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, "utf8").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = vals[i]?.trim() || ""));
    return row;
  });
}

function getUnprocessedWins() {
  const clients = parseCSV(CLIENTS_FILE);
  const processedFile = path.join(BASE, "leads", "proof-processed.txt");
  const processed = fs.existsSync(processedFile)
    ? fs.readFileSync(processedFile, "utf8").split("\n").filter(Boolean)
    : [];

  return clients.filter(
    (c) => c.status === "completed" && !processed.includes(c.id)
  );
}

function markProcessed(clientId) {
  const file = path.join(BASE, "leads", "proof-processed.txt");
  fs.appendFileSync(file, clientId + "\n");
}

function generateProofAsset(client) {
  const platform = client.platform || "their platform";
  const followers = client.followers || "their audience";
  const tier = client.tier || "the engine";

  return `# PROOF LOOP — ${client.name}

> Generated: ${new Date().toISOString()}
> Platform: ${platform} | Followers: ${followers} | Tier: ${tier}

---

## 📋 CASE STUDY (1 of 3)

**From:** "${client.name || "Creator"}" — ${followers} followers on ${platform}
**To:** First revenue from monetization system
**Timeframe:** ${client.start_date || "Recent"}

### The Situation
Creator with strong engagement on ${platform}. Consistent posting, growing audience, but zero monetization infrastructure.

### What We Built
Installed ${tier}: offer creation, funnel, and revenue system.

### The Result
Client is now converting attention into revenue. Details available upon request.

---

## 📱 POST 1 — Quick Win (LinkedIn/Twitter)

"Just closed another one.

Creator on ${platform} — ${followers} followers, great engagement.

ZERO monetization setup 30 days ago.

Now they have a system that converts.

This is why I don't do content.

I do money systems."

---

## 📱 POST 2 — Authority Build

"Most creators are sitting on an untapped revenue engine.

${followers} followers.

Engagement that actually converts.

But no offer. No funnel. No backend.

That's not a follower problem.

That's a system problem.

I fix the system."

---

## 📱 POST 3 — Story Format

"Last month: a creator DMed me.

'I've been posting daily for 2 years. 80K followers. I make $0/month.'

This week: their first sale came through.

Not from the algorithm.

From the system we built together.

Stop waiting for virality.

Start building the machine."

---

## 📣 AD 1 — Retargeting

"You've seen my content.

You know the problem.

Creator with ${followers} followers making nothing.

That's not a growth problem.

That's a monetization system problem.

I just fixed it for someone else.

Link in bio. Let's see if I can fix it for you."

---

## 📣 AD 2 — Social Proof

"Real talk:

80K followers. $0/month.

Until they installed the system.

Now they're converting.

If you're posting daily and the bank account is quiet —

that's what I fix.

Not more content. A monetization engine."

---

## 📞 OBJECTION CRUSHER (from this win)

"Will this actually work for me?"

→ "I just did it for a creator with ${followers} followers on ${platform}. Same situation. Same gap. Now they're running revenue."

---

## CTA ASSETS

**Copy-paste testimonial request:**
"Hey — congrats on the first $X! Can I use you as a case study? I'll keep it anonymous unless you want to name-drop. Either way, I appreciate you."

**Proof badge for website:**
"Trusted by creators on TikTok, LinkedIn, and Instagram — turning attention into revenue."
`;
}

function main() {
  console.log("\n💣 GHOST ENGINE — PROOF LOOP\n");

  const wins = getUnprocessedWins();

  if (wins.length === 0) {
    console.log("✅ No new wins to process.");
    return;
  }

  console.log(`🏆 ${wins.length} new win(s) to turn into proof assets:\n`);

  const allProof = wins.map((client) => {
    console.log(`  → ${client.name || client.email} (${client.platform})`);
    markProcessed(client.id);
    return generateProofAsset(client);
  });

  const proofDoc = `# Ghost Engine — Proof Loop\n> Generated: ${new Date().toISOString()}\n\n${allProof.join("\n\n---\n\n")}\n`;

  fs.writeFileSync(PROOF_OUT, proofDoc);
  console.log(`\n✅ Proof assets saved → ${PROOF_OUT}`);
  console.log("📋 Publish: 3 posts this week, retargeting ads, case study page");
}

if (require.main === module) main();
module.exports = { getUnprocessedWins, generateProofAsset };
