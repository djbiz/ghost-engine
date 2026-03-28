#!/usr/bin/env node
const fs = require('fs');
const CONFIG = {
  LINKEDIN_URL: "https://www.linkedin.com/in/derek-jamieson-8646a03ba/",
  LOG_FILE: "/home/workspace/Ghost-Monitization-Engine/leads/linkedin-engagement.log",
  START_DATE: "2026-03-28",
  DM_UNLOCK_DATE: "2026-04-11"
};
function log(msg) {
  const ts = new Date().toISOString();
  fs.appendFileSync(CONFIG.LOG_FILE, `[${ts}] ${msg}\n`);
  console.log(msg);
}
function getDayNumber() {
  const start = new Date(CONFIG.START_DATE);
  const now = new Date();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
}
async function main() {
  const day = getDayNumber();
  const dmReady = new Date() >= new Date(CONFIG.DM_UNLOCK_DATE);
  log(`=== LinkedIn Engagement — Day ${day} ===`);
  log(`DM unlock: ${dmReady ? "ACTIVE" : `${14 - day} days left (${CONFIG.DM_UNLOCK_DATE})`}`);
  log(`Mode: SANDBOX — likes, comments, connections only`);
  return { day, dmReady };
}
main().catch(console.error);
