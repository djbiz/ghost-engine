#!/usr/bin/env node
/**
 * Ghost Engine - Outreach Engine
 * Apollo + Gmail + CRM pipeline
 * 
 * Apollo free tier limitation: bulk search limited
 * Strategy: Manual lead entry + Gmail cold email + LinkedIn DMs via browser
 * 
 * Usage:
 *   node outreach-engine.js add-lead <name> <email> <platform> <followers> <notes>
 *   node outreach-engine.js send-batch <count>
 *   node outreach-engine.js status
 *   node outreach-engine.js score <id>
 */

const fs = require('fs');
const path = require('path');

const CRM_FILE = path.join(__dirname, '../leads/crm.csv');
const OUTREACH_LOG = path.join(__dirname, '../leads/outreach-log.jsonl');
const BOARDS_FILE = path.join(__dirname, '../leads/daily-hunt-log.csv');

// DM Templates (Felix-style, pattern interrupt)
const DM_TEMPLATES = [
  {
    id: 'binary_gap',
    type: 'TikTok/Reel',
    template: `Quick question — are you guys intentionally leaving money on the table with that audience, or has it just been one of those "figure it out later" things?`
  },
  {
    id: 'authority_shift', 
    type: 'YouTube/Podcast',
    template: `Most creators I talk to have the attention part dialed. The monetization? Still a mess. Curious where you guys are at with that.`
  },
  {
    id: 'speed_gap',
    type: 'LinkedIn',
    template: `Quick one — are you guys running paid ads without a proper conversion system, or is that just how it's been going?`
  }
];

function ensureFile(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '');
  }
}

function loadCRM() {
  ensureFile(CRM_FILE);
  const content = fs.readFileSync(CRM_FILE, 'utf8').trim();
  if (!content) return [];
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = vals[i] || '');
    return obj;
  });
}

function saveCRM(rows) {
  const headers = Object.keys(rows[0] || {});
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => r[h] || '').join(',')));
  fs.writeFileSync(CRM_FILE, lines.join('\n'));
}

function generateEmail(lead) {
  const firstName = lead.name.split(' ')[0];
  const platform = lead.platform || 'audience';
  const followers = parseInt(lead.followers || '0').toLocaleString();
  
  const templates = [
    `Hey ${firstName},

Quick question — are you guys intentionally leaving money on the table with that ${followers}-person ${platform} audience, or has it just been one of those "get to it later" things?

I've been working with creators who got the attention part right — now they're figuring out how to actually convert it.

Not sure if that's even on your radar, but figured I'd reach out.

Best,
Derek`,
    `Hey ${firstName} —

Most creators I talk to have the "get more views" part figured out.

The monetization part? Still a mess.

Curious where you guys are at with converting that ${platform} audience into actual revenue.

If it's not relevant, just say the word and I'll leave you alone.

If it is — I'd love to show you what we're seeing across similar creators.

Either way, no pressure.

— Derek`,
    `Hey ${firstName},

I've been stalking your ${platform} (${followers} followers — solid work).

Here's what I notice: the attention is real. The money system? Probably not.

Not an insult — that's most creators 6-12 months in.

What would change your mind about monetizing that audience more aggressively?

If you're open to it, I'd love to show you what we build for creators in your space.

No pitch. Just a real conversation about what's actually working.

— Derek`
  ];
  
  const subjects = [
    `Quick question about your ${platform} monetization`,
    `${firstName} — monetize question`,
    `Noticed your ${platform}, had a thought`,
    `${firstName} — monetization gap?`
  ];
  
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  
  return { body: tpl, subject };
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'add-lead') {
  const [name, email, platform, followers, notes = ''] = args.slice(1);
  if (!name || !email) {
    console.log('Usage: node outreach-engine.js add-lead <name> <email> <platform> <followers> [notes]');
    process.exit(1);
  }
  
  const rows = loadCRM();
  const id = 'lead_' + Date.now();
  const score = Math.min(100, Math.floor(Math.random() * 30) + 50); // 50-80 score
  const newRow = {
    id, timestamp: new Date().toISOString(), name, email,
    platform: platform || '', followers: followers || '0',
    email: email, score, status: 'new',
    last_contact: '', notes, dms_sent: '0', replies: '0'
  };
  rows.push(newRow);
  saveCRM(rows);
  
  console.log(`\n[ADDED] ${name} (${email})`);
  console.log(`  Platform: ${platform} | Followers: ${followers}`);
  console.log(`  Score: ${score} | Status: new`);
  console.log(`  ID: ${id}`);
  console.log(`\nNext: node outreach-engine.js send-batch <count>`);
}
else if (cmd === 'send-batch') {
  const count = parseInt(args[1] || '10');
  const rows = loadCRM().filter(r => r.status === 'new' || r.status === 'contacted');
  const batch = rows.slice(0, count);
  
  console.log(`\n[SEND BATCH] Preparing ${batch.length} emails...\n`);
  
  batch.forEach((lead, i) => {
    const { body, subject } = generateEmail(lead);
    console.log(`[${i+1}/${batch.length}] ${lead.name} (${lead.email})`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Preview: ${body.substring(0, 80).replace(/\n/g, ' ')}...`);
    console.log('');
    
    // Update status
    lead.status = 'contacted';
    lead.last_contact = new Date().toISOString();
    lead.dms_sent = parseInt(lead.dms_sent || 0) + 1;
  });
  
  saveCRM(rows);
  console.log(`\n[DONE] ${batch.length} emails prepared.`);
  console.log(`Copy the email bodies above and send via Gmail.`);
  console.log(`Or upgrade Apollo for bulk send.`);
}
else if (cmd === 'status') {
  const rows = loadCRM();
  const total = rows.length;
  const contacted = rows.filter(r => r.status === 'contacted').length;
  const qualified = rows.filter(r => r.status === 'qualified').length;
  const hot = rows.filter(r => parseInt(r.score || 0) >= 75).length;
  
  console.log(`\n[OUTREACH STATUS]`);
  console.log(`  Total leads: ${total}`);
  console.log(`  Contacted: ${contacted}`);
  console.log(`  Qualified: ${qualified}`);
  console.log(`  Hot leads (75+): ${hot}`);
  console.log(`\n  Next action: node outreach-engine.js add-lead <name> <email> <platform> <followers>`);
}
else if (cmd === 'score') {
  const leadId = args[1];
  const rows = loadCRM();
  const lead = rows.find(r => r.id === leadId);
  if (!lead) { console.log('Lead not found'); process.exit(1); }
  
  const score = Math.min(100, 
    (parseInt(lead.followers || 0) > 10000 ? 30 : 10) +
    (lead.platform === 'TikTok' ? 20 : lead.platform === 'YouTube' ? 25 : 15) +
    Math.floor(Math.random() * 20) + 30
  );
  lead.score = score;
  saveCRM(rows);
  
  const tier = score >= 80 ? 'FULL ENGINE' : score >= 60 ? 'QUICK FLIP' : 'NURTURE';
  console.log(`\n[SCORED] ${lead.name}`);
  console.log(`  Score: ${score}/100`);
  console.log(`  Tier: ${tier}`);
  console.log(`  Status: ${lead.status}`);
}
else {
  console.log(`
GHOST ENGINE — OUTREACH ENGINE
===============================

Commands:
  add-lead <name> <email> <platform> <followers> [notes]
      Add a new lead to the CRM
      
  send-batch <count>
      Generate <count> personalized email drafts
      
  status
      Show current pipeline status
      
  score <lead_id>
      Score a specific lead
      
Examples:
  node outreach-engine.js add-lead "Alex Rivera" "alex@tiktok.com" "TikTok" "45000"
  node outreach-engine.js add-lead "Jordan Lee" "jordan@yt.com" "YouTube" "120000" "podcast host"
  node outreach-engine.js send-batch 10
  node outreach-engine.js status
`);
}
