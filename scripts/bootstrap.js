#!/usr/bin/env node
/**
 * BOOTSTRAP — Felix-Style Startup Sequence
 * Zo loads this at the START OF EVERY SESSION before doing anything else.
 *
 * This is the single most important file in the Ghost Engine system.
 * Nat Eliason's key insight: "Get the memory structure in first because
 * then your conversations from day one will be useful."
 *
 * Run order:
 *   1. Read MEMORY.md (long-term facts)
 *   2. Read today's daily note (if exists)
 *   3. Read leads/clients CRM (pipeline state)
 *   4. Check for any pending actions from yesterday
 *   5. THEN start the conversation
 */

const fs = require("fs");
const path = require("path");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const SYSTEM = path.join(BASE, "system");
const DAILY = path.join(BASE, "daily");

function readIfExists(filepath) {
  return fs.existsSync(filepath) ? fs.readFileSync(filepath, "utf8") : null;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function bootstrap() {
  console.log("\n🧠 BOOTING GHOST ENGINE — FELIX MODE\n" + "═".repeat(50));

  // Layer 1: Long-term memory
  const memory = readIfExists(path.join(BASE, "MEMORY.md"));
  if (memory) {
    console.log("📚 Layer 1 (MEMORY.md): LOADED");
    console.log("   → Business state, identity, hard rules, operating principles");
  } else {
    console.log("⚠️  Layer 1 (MEMORY.md): MISSING — run setup first");
  }

  // Layer 2: Today's daily note
  const todayFile = path.join(DAILY, `${getTodayDate()}.md`);
  const todayNote = readIfExists(todayFile);
  if (todayNote) {
    console.log(`📅 Layer 2 (daily/${getTodayDate()}.md): LOADED`);
    console.log("   → What happened today so far");
  } else {
    console.log(`📅 Layer 2 (daily/${getTodayDate()}.md): EMPTY — will create`);
  }

  // Layer 3: Pipeline state
  const crmFile = path.join(BASE, "leads", "crm.csv");
  const clientsFile = path.join(BASE, "clients", "active.csv");
  const inboundFile = path.join(BASE, "leads", "inbound.csv");

  if (fs.existsSync(crmFile)) {
    const lines = fs.readFileSync(crmFile, "utf8").trim().split("\n");
    console.log(`\n📊 PIPELINE: ${lines.length - 1} leads in system`);
  }
  if (fs.existsSync(clientsFile)) {
    const lines = fs.readFileSync(clientsFile, "utf8").trim().split("\n");
    console.log(`💰 CLIENTS: ${lines.length - 1} active clients`);
  }

  // Check yesterday's pending actions
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFile = path.join(DAILY, yesterday.toISOString().slice(0, 10) + ".md");
  if (fs.existsSync(yesterdayFile)) {
    const content = fs.readFileSync(yesterdayFile, "utf8");
    if (content.includes("PENDING") || content.includes("TODO")) {
      console.log("\n⚡ YESTERDAY HAD PENDING ACTIONS — review before continuing");
    }
  }

  // Quick stats
  console.log("\n" + "═".repeat(50));
  console.log("✅ BOOTSTRAP COMPLETE — Zo is fully oriented\n");
}

bootstrap().catch(console.error);
