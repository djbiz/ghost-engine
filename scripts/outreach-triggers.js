#!/usr/bin/env node
/**
 * Ghost Engine — Automated Outreach Triggers
 * Triggers automatic outreach when leads meet criteria
 * 
 * Trigger Rules:
 *   - score > 75: Hot lead alert
 *   - engagement_rate > 5%: High engagement alert  
 *   - days_since_contact > 7: Re-engagement trigger
 *   - platform_followers > 100K: Influencer trigger
 *   - status = qualified: Nurture sequence start
 * 
 * Usage:
 *   node outreach-triggers.js run
 *   node outreach-triggers.js add-rule <rule_json>
 *   node outreach-triggers.js list-rules
 *   node outreach-triggers.js history
 *   node outreach-triggers.js test-rule <rule_id>
 */

const fs = require('fs');
const path = require('path');

const CRM_FILE = path.join(__dirname, '../leads/crm.csv');
const RULES_FILE = path.join(__dirname, '../leads/trigger-rules.json');
const TRIGGER_LOG = path.join(__dirname, '../leads/trigger-history.jsonl');
const OUTREACH_HISTORY = path.join(__dirname, '../leads/outreach-history.jsonl');

const DEFAULT_RULES = [
  {
    id: 'rule_score_hot',
    name: 'Hot Lead Score Alert',
    condition: { field: 'score', operator: 'gt', value: 75 },
    action: { type: 'email', template: 'hot_lead_alert', priority: 'high' },
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule_engagement_high',
    name: 'High Engagement Trigger',
    condition: { field: 'engagement_rate', operator: 'gt', value: 5 },
    action: { type: 'email', template: 'high_engagement', priority: 'high' },
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule_reengage_7days',
    name: '7-Day Re-engagement',
    condition: { field: 'days_since_contact', operator: 'gt', value: 7 },
    action: { type: 'dm', template: 'reengage', priority: 'medium' },
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule_influencer',
    name: 'Influencer Trigger (100K+)',
    condition: { field: 'followers', operator: 'gte', value: 100000 },
    action: { type: 'email', template: 'influencer_outreach', priority: 'high' },
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule_qualified_nurture',
    name: 'Qualified Lead Nurture',
    condition: { field: 'status', operator: 'eq', value: 'qualified' },
    action: { type: 'sequence', template: 'nurture_14day', priority: 'medium' },
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule_tiktok_creator',
    name: 'TikTok Creator Quick Flip',
    condition: { field: 'platform', operator: 'eq', value: 'tiktok' },
    action: { type: 'dm', template: 'tiktok_quick_flip', priority: 'medium' },
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule_youtube_monetization',
    name: 'YouTube Monetization Gap',
    condition: { field: 'platform', operator: 'eq', value: 'youtube' },
    action: { type: 'email', template: 'youtube_monetization', priority: 'medium' },
    enabled: true,
    createdAt: new Date().toISOString()
  }
];

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) {
    fs.writeFileSync(RULES_FILE, JSON.stringify(DEFAULT_RULES, null, 2));
    return DEFAULT_RULES;
  }
  return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}

function saveRules(rules) {
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
}

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
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').replace(/^"|"$/g, ''));
    return obj;
  });
}

function evaluateCondition(lead, condition) {
  let leadValue = lead[condition.field];
  
  if (condition.field === 'days_since_contact') {
    if (!lead.last_contact) return false;
    const days = Math.floor((Date.now() - new Date(lead.last_contact)) / (1000 * 60 * 60 * 24));
    leadValue = days;
  }
  
  if (condition.field === 'followers') {
    leadValue = parseInt(leadValue || '0');
  }
  
  if (condition.field === 'score') {
    leadValue = parseInt(leadValue || '0');
  }
  
  if (condition.field === 'engagement_rate') {
    leadValue = parseFloat(leadValue || '0');
  }
  
  const targetValue = condition.value;
  
  switch (condition.operator) {
    case 'eq': return leadValue == targetValue;
    case 'neq': return leadValue != targetValue;
    case 'gt': return leadValue > targetValue;
    case 'gte': return leadValue >= targetValue;
    case 'lt': return leadValue < targetValue;
    case 'lte': return leadValue <= targetValue;
    case 'contains': return String(leadValue).toLowerCase().includes(String(targetValue).toLowerCase());
    default: return false;
  }
}

const TEMPLATES = {
  hot_lead_alert: {
    subject: '🔥 Hot Lead Alert: {name}',
    body: `Hey Derek,

Lead triggered: {name}
- Platform: {platform}
- Followers: {followers}
- Score: {score}
- Email: {email}

Next action: Priority outreach within 2 hours.
`
  },
  high_engagement: {
    subject: '📈 High Engagement Lead: {name}',
    body: `Hey Derek,

{platform} creator with {engagement_rate}% engagement detected.

{followers} followers with strong engagement signals.
Email: {email}

Recommend: Personalized outreach highlighting their engagement strength.
`
  },
  reengage: {
    subject: 'Re-engaging: {name}',
    body: `Hey {name},

It's been {days_since_contact} days since we connected. I know you're busy building your audience.

Quick question — have you had a chance to think about monetization options for your {platform} following?

No pressure — just wanted to check in.
`
  },
  influencer_outreach: {
    subject: 'Partnership Opportunity — {name}',
    body: `Hey {name},

Huge audience you've built ({followers} followers). Serious platform leverage.

I work with creators at your level to build monetization systems that actually convert.

Worth a 15-min call to see if there's a fit?

— Derek
`
  },
  tiktok_quick_flip: {
    subject: 'Quick question about your TikTok',
    body: `Hey {name},

Stalked your TikTok — solid content, engaged audience, but I noticed you don't have a proper monetization setup.

That's actually the gap I help creators fill.

Quick question: are you actually monetizing that audience, or still figuring it out?
`
  },
  youtube_monetization: {
    subject: 'YouTube monetization question',
    body: `Hey {name},

Just checked out your channel — {followers} subscribers is solid growth.

Question: do you have a backend set up to actually monetize those views? 
Or is that still on the roadmap?

I help creators bridge that gap. Worth a quick conversation if it's relevant.
`
  },
  nurture_14day: {
    subject: 'Following up — {name}',
    body: `Hey {name},

Great chat earlier. Here's what we covered:

• Your {platform} has {followers} potential
• Monetization gap we can close
• Quick Flip: $990 (test it)
• Full Engine: $4,970 (full system)

Let me know if you have questions.
`
  }
};

function generateFromTemplate(templateKey, lead) {
  const template = TEMPLATES[templateKey];
  if (!template) return { subject: 'Update', body: 'Template not found' };
  
  let subject = template.subject;
  let body = template.body;
  
  Object.keys(lead).forEach(key => {
    const placeholder = `{${key}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), lead[key] || '');
    body = body.replace(new RegExp(placeholder, 'g'), lead[key] || '');
  });
  
  if (lead.days_since_contact) {
    body = body.replace(/{days_since_contact}/g, lead.days_since_contact);
  }
  
  return { subject, body };
}

function logTrigger(trigger) {
  ensureFile(TRIGGER_LOG);
  fs.appendFileSync(TRIGGER_LOG, JSON.stringify({
    ...trigger,
    triggeredAt: new Date().toISOString()
  }) + '\n');
}

function logOutreach(outreach) {
  ensureFile(OUTREACH_HISTORY);
  fs.appendFileSync(OUTREACH_HISTORY, JSON.stringify({
    ...outreach,
    sentAt: new Date().toISOString()
  }) + '\n');
}

function runTriggers() {
  const rules = loadRules().filter(r => r.enabled);
  const leads = loadCRM();
  const triggered = [];
  
  console.log('\n🎯 Running Outreach Triggers...\n');
  
  leads.forEach(lead => {
    rules.forEach(rule => {
      if (evaluateCondition(lead, rule.condition)) {
        const trigger = {
          leadId: lead.id,
          leadName: lead.name,
          ruleId: rule.id,
          ruleName: rule.name,
          actionType: rule.action.type,
          template: rule.action.template,
          priority: rule.action.priority
        };
        
        const { subject, body } = generateFromTemplate(rule.action.template, lead);
        trigger.generatedSubject = subject;
        trigger.generatedBody = body;
        
        triggered.push(trigger);
        logTrigger(trigger);
        
        logOutreach({
          leadId: lead.id,
          leadEmail: lead.email,
          leadName: lead.name,
          channel: rule.action.type,
          template: rule.action.template,
          status: 'generated',
          ruleId: rule.id
        });
        
        console.log(`  ✓ ${rule.name} → ${lead.name} (${rule.action.type})`);
      }
    });
  });
  
  console.log(`\n✓ Triggered ${triggered.length} outreach actions\n`);
  console.log('Generated messages ready for sending. Copy to Gmail/LinkedIn.');
  
  return triggered;
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'run') {
  runTriggers();
}
else if (cmd === 'list-rules') {
  const rules = loadRules();
  console.log('\n📋 Trigger Rules\n');
  rules.forEach(r => {
    const status = r.enabled ? '✓' : '✗';
    console.log(`  ${status} ${r.name} [${r.id}]`);
    console.log(`      Condition: ${r.condition.field} ${r.condition.operator} ${r.condition.value}`);
    console.log(`      Action: ${r.action.type} → ${r.action.template}`);
    console.log();
  });
}
else if (cmd === 'add-rule') {
  const rules = loadRules();
  try {
    const newRule = JSON.parse(args.slice(1).join(' '));
    newRule.id = 'rule_' + Date.now();
    newRule.createdAt = new Date().toISOString();
    rules.push(newRule);
    saveRules(rules);
    console.log(`✓ Added rule: ${newRule.name}`);
  } catch (e) {
    console.log('Invalid JSON. Usage: node outreach-triggers.js add-rule \'{"name":"Test","condition":{"field":"score","operator":"gt","value":80},"action":{"type":"email","template":"hot_lead_alert"}}\'');
  }
}
else if (cmd === 'history') {
  ensureFile(TRIGGER_LOG);
  const content = fs.readFileSync(TRIGGER_LOG, 'utf8').trim();
  if (!content) {
    console.log('No trigger history yet.');
    process.exit(0);
  }
  
  const lines = content.split('\n').reverse().slice(0, 20);
  console.log('\n📜 Recent Triggers\n');
  lines.forEach(line => {
    const entry = JSON.parse(line);
    console.log(`  [${entry.triggeredAt.split('T')[0]}] ${entry.ruleName} → ${entry.leadName}`);
  });
}
else if (cmd === 'test-rule') {
  const rules = loadRules();
  const rule = rules.find(r => r.id === args[1]);
  if (!rule) {
    console.log(`Rule not found: ${args[1]}`);
    console.log('Run: node outreach-triggers.js list-rules');
    process.exit(1);
  }
  
  const leads = loadCRM();
  console.log(`\nTesting rule: ${rule.name}\n`);
  
  leads.forEach(lead => {
    if (evaluateCondition(lead, rule.condition)) {
      const { subject, body } = generateFromTemplate(rule.action.template, lead);
      console.log(`  ✓ MATCH: ${lead.name}`);
      console.log(`    Subject: ${subject}`);
      console.log(`    Body: ${body.substring(0, 100)}...`);
      console.log();
    }
  });
}
else if (cmd === 'status') {
  const rules = loadRules();
  const enabled = rules.filter(r => r.enabled).length;
  const leads = loadCRM();
  
  ensureFile(TRIGGER_LOG);
  const content = fs.readFileSync(TRIGGER_LOG, 'utf8').trim();
  const triggerCount = content ? content.split('\n').length : 0;
  
  console.log(`
╔════════════════════════════════════════╗
║   Outreach Triggers — Status          ║
╠════════════════════════════════════════╣
║  Rules: ${rules.length} total | ${enabled} active       ║
║  Leads in CRM: ${leads.length.toString().padEnd(16)}║
║  Triggers fired: ${triggerCount.toString().padEnd(16)}║
╚════════════════════════════════════════╝

Commands:
  run          - Execute all triggers
  list-rules   - Show all rules
  add-rule     - Add new rule
  test-rule    - Test specific rule
  history      - Show trigger history
`);
}
else {
  console.log(`
╔════════════════════════════════════════╗
║   Ghost Engine — Outreach Triggers   ║
╠════════════════════════════════════════╣
║                                        ║
║  Commands:                            ║
║    run              - Run all triggers ║
║    list-rules       - Show all rules   ║
║    add-rule         - Add new rule     ║
║    test-rule <id>   - Test a rule      ║
║    history          - Trigger history  ║
║    status           - Show status      ║
║                                        ║
║  Trigger Conditions:                  ║
║    score > 75       - Hot lead        ║
║    engagement > 5%  - High engagers    ║
║    days > 7         - Re-engage       ║
║    followers >= 100K - Influencer     ║
║    status = qualified - Nurture      ║
╚════════════════════════════════════════╝
`);
}