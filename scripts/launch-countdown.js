#!/usr/bin/env node
/**
 * Ghost Engine — Launch Countdown Dashboard
 * Run: node scripts/launch-countdown.js
 */

const fs = require('fs');

const LAUNCH_DATE = new Date('2026-04-11T13:00:00Z'); // April 11, 9 AM ET
const today = new Date();

const daysLeft = Math.ceil((LAUNCH_DATE - today) / (1000 * 60 * 60 * 24));
const hoursLeft = Math.ceil((LAUNCH_DATE - today) / (1000 * 60 * 60));
const minsLeft = Math.ceil((LAUNCH_DATE - today) / (1000 * 60));

const milestones = [
  { day: 'Apr 5', label: 'Content Drop #1', done: daysLeft < 6 },
  { day: 'Apr 7', label: 'Content Drop #2', done: daysLeft < 4 },
  { day: 'Apr 8', label: 'DM Templates Finalized', done: daysLeft < 3 },
  { day: 'Apr 9', label: 'Content Drop #3 + System Test', done: daysLeft < 2 },
  { day: 'Apr 10', label: 'Final Prep Day', done: daysLeft < 1 },
  { day: 'Apr 11', label: '🔥 LAUNCH DAY — DMs Fire', done: false },
];

// Load CRM stats
let crmStats = { total: 0, scored: 0, tier1: 0, tier2: 0, tier3: 0 };
try {
  const crm = fs.readFileSync('/home/workspace/Ghost-Monitization-Engine/leads/crm.csv', 'utf8');
  const lines = crm.trim().split('\n').slice(1);
  crmStats.total = lines.length;
  crmStats.scored = lines.filter(l => l.split(',')[8] && l.split(',')[8] > '0').length;
  crmStats.tier1 = lines.filter(l => l.includes('tier1')).length;
  crmStats.tier2 = files.filter(l => l.includes('tier2')).length;
  crmStats.tier3 = lines.filter(l => l.includes('tier3')).length;
} catch (e) {}

// Load engagement log
let engCount = 0;
try {
  const log = fs.readFileSync('/home/workspace/Ghost-Monitization-Engine/leads/linkedin-engagement.log', 'utf8');
  engCount = log.trim().split('\n').length;
} catch (e) {}

console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🎯 GHOST ENGINE — LAUNCH COUNTDOWN                ║
║                                                      ║
║   ┌──────────────────────────────────────────────┐   ║
║   │                                              │   ║
║   │          ${daysLeft < 10 ? ' ' : ''} ${daysLeft} DAYS UNTIL LAUNCH          │   ║
║   │          ${hoursLeft < 100 ? ' ' : ''}${hoursLeft} HOURS / ${minsLeft} MINUTES               │   ║
║   │                                              │   ║
║   └──────────────────────────────────────────────┘   ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   📅 LAUNCH MILESTONES                              ║
`);
milestones.forEach(m => {
  const icon = m.done ? '✅' : m.label.includes('LAUNCH') ? '🔥' : '⏳';
  console.log(`║   ${icon} ${m.day} — ${m.label.padEnd(35)}║`);
});

console.log(`║                                                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   📊 PIPELINE STATUS                                ║
║                                                      ║
║   Leads in CRM:     ${String(crmStats.total).padStart(4)} / 175                  ║
║   Scored:           ${String(crmStats.scored).padStart(4)} / 175                  ║
║   Tier 1 (Quick):   ${String(crmStats.tier1).padStart(4)}                        ║
║   Tier 2 (Engine):  ${String(crmStats.tier2).padStart(4)}                        ║
║   Tier 3 (Partner): ${String(crmStats.tier3).padStart(4)}                        ║
║                                                      ║
║   LinkedIn Engaged: ${String(engCount).padStart(4)} (sandbox mode)        ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   💰 REVENUE TARGET (April)                         ║
║                                                      ║
║   Quick Flip closes:  ${String(Math.floor(crmStats.tier1 * 0.2)).padStart(3)} / 10                   ║
║   Full Engine closes: ${String(Math.floor(crmStats.tier2 * 0.15)).padStart(3)} / 4                    ║
║   Ghost Partner:      ${String(Math.floor(crmStats.tier3 * 0.1)).padStart(3)} / 2                    ║
║   ─────────────────────────────────                 ║
║   Revenue:           $${String(Math.floor((crmStats.tier1 * 0.2 * 990) + (crmStats.tier2 * 0.15 * 4970) + (crmStats.tier3 * 0.1 * 9700))).padStart(5)} / $50,000           ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   ⚡ NEXT ACTIONS                                   ║
║                                                      ║
`);

if (daysLeft > 13) {
  console.log(`║   TODAY:     Run Apollo hunt (4 segments)             ║
║   TOMORROW:  Post Content #1 (Apr 5)                 ║
║   APR 8:     Finalize DM templates                   ║`);
} else if (daysLeft > 6) {
  console.log(`║   URGENT:    Import Apollo leads to CRM               ║
║   URGENT:    Score all leads                         ║
║   THIS WEEK: Post content 2x                         ║`);
} else if (daysLeft > 2) {
  console.log(`║   SYSTEM TEST: Run outreach pipeline end-to-end       ║
║   CONTENT:   Post #3 on Apr 9                        ║
║   TOMORROW:  Final DM template review                ║`);
} else if (daysLeft > 0) {
  console.log(`║   ⚡ FINAL PREP DAY — April 10                        ║
║   • Verify all 25 Tier 1 DMs ready                  ║
║   • Confirm Calendly + Stripe live                   ║
║   • Derek on standby for calls                      ║`);
} else {
  console.log(`║   🔥🔥🔥 LAUNCH DAY — APRIL 11 🔥🔥🔥                    ║
║   • 9 AM: Zo fires Batch 1 (25 DMs)                 ║
║   • 10 AM: Zo fires email batch                     ║
║   • Monitor replies + take calls                    ║`);
}

console.log(`║                                                      ║
╚══════════════════════════════════════════════════════╝
`);

if (daysLeft <= 0) {
  console.log('🔥🔥🔥 LAUNCH DAY — LET\'S GO 🔥🔥🔥\n');
} else if (daysLeft <= 3) {
  console.log('⏰ LAUNCH IMMINENT — FINAL PREP NOW\n');
} else if (daysLeft <= 7) {
  console.log('📊 PIPELINE WEEK — FOCUS ON LEADS\n');
} else {
  console.log('🗓️ PRE-LAUNCH PHASE — BUILD THE MACHINE\n');
}
