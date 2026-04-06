#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// --- Signal copy maps ---

const WEAK_SIGNAL_COPY = {
  'no-chatbot': 'no live chat or AI lead capture on their site',
  'no-cta': 'no clear call-to-action above the fold',
  'slow-load': 'slow page load speed killing conversions before they start',
  'bad-reviews': 'bad or missing reviews hurting social proof',
  'no-after-hours': 'no after-hours lead capture — losing leads while they sleep'
};

const MONTHLY_LEAK = {
  'no-chatbot': '5–15 qualified leads',
  'no-cta': '20–40% of your visitors',
  'slow-load': 'up to 53% of mobile visitors',
  'bad-reviews': '15–25% of warm prospects',
  'no-after-hours': 'every lead that visits outside 9–5'
};

const SPECIFIC_FIX = {
  'no-chatbot': 'deploys an AI chatbot that greets visitors, answers questions, and captures their contact info automatically',
  'no-cta': 'adds a high-converting offer above the fold with a clear next step for every visitor',
  'slow-load': 'optimizes your load flow and adds an instant engagement hook before the page finishes loading',
  'bad-reviews': 'installs a reputation capture widget that turns happy customers into public reviews automatically',
  'no-after-hours': 'sets up an AI agent that handles after-hours inquiries, qualifies leads, and books callbacks automatically'
};

// --- Helpers ---

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function nowISO() {
  return new Date().toISOString();
}

function timestamp() {
  return Date.now();
}

// --- Generate video script ---

function generateScript(leadName, businessName, websiteUrl, weakSignal) {
  const signalCopy = WEAK_SIGNAL_COPY[weakSignal];
  const leak = MONTHLY_LEAK[weakSignal];
  const fix = SPECIFIC_FIX[weakSignal];
  const ts = nowISO();

  return `# Video Audit Script — ${businessName}
**Lead:** ${leadName} | **URL:** ${websiteUrl} | **Signal:** ${weakSignal}
**Generated:** ${ts}

---

## Hook (0–10s)
"I just pulled up ${businessName}'s website — ${websiteUrl} — and within 30 seconds I spotted something that's probably costing you leads every single day."

## The Leak (10–30s)
"Here's the problem: ${signalCopy}. For a business like ${businessName}, that means every visitor who lands on your site and doesn't convert is just gone — no follow-up, no second chance. Based on average traffic patterns, this could be ${leak} in missed opportunities every month."

## The Fix (30–50s)
"What I'd install is an AI lead capture system — it ${fix}. It works 24/7, it's personalized, and it captures contact info even from people who aren't ready to buy today. I can have this live on ${websiteUrl} within 24 hours."

## The Outcome (50–65s)
"Businesses like ${businessName} typically capture 15–30% more leads in the first 30 days after install. That's not a projection — that's what we're seeing across the board."

## Soft CTA (65–75s)
"If you want me to install this for you, I'll have it live in 24 hours — link's in my next message."
`;
}

// --- Generate email opener ---

function generateEmail(leadName, businessName, websiteUrl, weakSignal) {
  const signalCopy = WEAK_SIGNAL_COPY[weakSignal];

  return `# Email Opener — ${businessName}
**Lead:** ${leadName} | **Signal:** ${weakSignal}

---

Subject: quick find on ${businessName}'s site

Hey ${leadName},

I was checking out ${websiteUrl} and noticed ${signalCopy}.

Recorded a quick 60-second audit showing exactly what it's costing you and how to fix it.

[video link placeholder]

Worth a look — takes 60 seconds.

— Zo
`;
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.error('Usage: node video-audit-generator.js <lead_name> <business_name> <website_url> <weak_signal>');
    console.error('');
    console.error('Weak signals: no-chatbot, no-cta, slow-load, bad-reviews, no-after-hours');
    process.exit(1);
  }

  const leadName = args[0];
  const businessName = args[1];
  const websiteUrl = args[2];
  const weakSignal = args[3];

  if (!WEAK_SIGNAL_COPY[weakSignal]) {
    console.error('Unknown weak signal: ' + weakSignal);
    console.error('Valid options: ' + Object.keys(WEAK_SIGNAL_COPY).join(', '));
    process.exit(1);
  }

  // Generate content
  const script = generateScript(leadName, businessName, websiteUrl, weakSignal);
  const email = generateEmail(leadName, businessName, websiteUrl, weakSignal);

  // Build paths
  const ts = timestamp();
  const slug = slugify(leadName);
  const dir = path.join(ROOT, 'assets', 'video-scripts');
  const scriptFile = path.join(dir, ts + '-' + slug + '.md');
  const emailFile = path.join(dir, ts + '-' + slug + '-email.md');

  // Create directory if missing
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write files
  fs.writeFileSync(scriptFile, script, 'utf8');
  fs.writeFileSync(emailFile, email, 'utf8');

  // Append to slog.jsonl
  const slogPath = path.join(ROOT, 'slog.jsonl');
  const slogEntry = {
    ts: nowISO(),
    event: 'video-audit-generated',
    lead: leadName,
    business: businessName,
    signal: weakSignal,
    script_path: path.relative(ROOT, scriptFile)
  };
  fs.appendFileSync(slogPath, '\n' + JSON.stringify(slogEntry), 'utf8');

  // Print confirmation
  console.log('Video audit script generated:');
  console.log('  Script: ' + path.relative(ROOT, scriptFile));
  console.log('  Email:  ' + path.relative(ROOT, emailFile));
}

main();
