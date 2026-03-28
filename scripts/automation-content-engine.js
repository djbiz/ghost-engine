#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Conversation → Content Engine
 * Daily: pull top objections + questions → auto-generate posts, ads, hooks
 *
 * Usage: node automation-content-engine.js
 * Runs as part of the 7:30 AM Lead Hunter agent
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const BASE = path.join(__dirname, "..");
const CRM_FILE = path.join(BASE, "leads", "crm.csv");
const OUT_FILE = path.join(BASE, "assets", "daily-content-brief.md");

// What to track in conversations
const OBJECTION_TRACKER_FILE = path.join(BASE, "leads", "objections.csv");

// ─── CONTENT GENERATION PROMPTS ───────────────────────────────────────────────

const CONTENT_BRIEF = `
Generate content for Ghost Monetization Engine based on today's objections.

TONE: Direct, sharp, founder energy. No fluff.
AUDIENCE: Creators, 5K–500K followers, leaving money on the table.
PLATFORM: LinkedIn, TikTok, Twitter/X.

Generate:

## 3 HOOKS
(Stop-scroll, pattern interrupt, curiosity gap)

## 2 LINKEDIN POSTS
(Viral authority angle — see assets/LINKEDIN-POSTS.md for structure)

## 1 TIKTOK CAPTION
(15–30 sec, matches current campaign)

## 3 OBJECTION CRUSHERS
(For: "not now", "send info", "too expensive", "need to think")

## 1 AD ANGLE
(New creative for paid social)

---

Return in this format:

### HOOKS
[hook 1]
---
[hook 2]
---
[hook 3]

### LINKEDIN POSTS
[post 1]
---
[post 2]

### TIKTOK CAPTION
[caption]

### OBJECTION CRUSHERS
[objection] → [crusher response]

### AD ANGLE
[angle]

---
`;

// ─── MAIN ────────────────────────────────────────────────────────────────────

function getTodaysObjections() {
  if (!fs.existsSync(OBJECTION_TRACKER_FILE)) return [];
  const content = fs.readFileSync(OBJECTION_TRACKER_FILE, "utf8");
  const lines = content.trim().split("\n").slice(1); // skip header
  const today = new Date().toISOString().split("T")[0];
  return lines
    .filter((l) => l.includes(today))
    .map((l) => {
      const [date, objection, source] = l.split(",");
      return { date, objection, source };
    });
}

function generateBrief(objections) {
  const objSection =
    objections.length > 0
      ? `Today's top objections from real conversations:\n${objections.map((o) => `- ${o.objection} (from ${o.source})`).join("\n")}`
      : "No new objections today — use general creator monetization angles.";

  return `## TODAY'S MARKET INTEL\n${objSection}\n\n${CONTENT_BRIEF}`;
}

async function callZoForBrief(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      input: prompt,
      model_name: "vercel:minimax/minimax-m2.7",
      output_format: { type: "object", properties: { hooks: { type: "string" }, posts: { type: "string" }, caption: { type: "string" }, objections: { type: "string" }, ad: { type: "string" } }, required: ["hooks", "posts", "caption", "objections", "ad"] },
    });

    const options = {
      hostname: "api.zo.computer",
      path: "/zo/ask",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ZO_CLIENT_IDENTITY_TOKEN}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.output || parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("\n🎯 GHOST ENGINE — CONTENT ENGINE\n");

  const objections = getTodaysObjections();
  const prompt = generateBrief(objections);

  console.log(`📊 ${objections.length} objections logged today`);
  console.log("🧠 Generating content brief...\n");

  try {
    const result = await callZoForBrief(prompt);
    const brief = `<!-- Generated: ${new Date().toISOString()} -->
# Daily Content Brief
> Auto-generated from Ghost Engine objection tracking

${typeof result === "string" ? result : JSON.stringify(result, null, 2)}
`;

    fs.writeFileSync(OUT_FILE, brief);
    console.log(`✅ Brief saved → ${OUT_FILE}\n`);
    console.log("📋 Preview:\n");
    console.log(brief.slice(0, 800));
    console.log("\n...");
  } catch (err) {
    console.error("⚠️  Could not generate via API:", err.message);
    console.log("\n📝 MANUAL BRIEF TEMPLATE (copy to daily-content-brief.md):\n");
    console.log(`Objections today: ${objections.length}`);
    console.log(prompt);
  }
}

if (require.main === module) main();
module.exports = { getTodaysObjections, generateBrief };
