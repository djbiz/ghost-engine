#!/usr/bin/env node
/**
 * Ghost Engine — Automated Outreach Triggers
 * Triggers automated actions based on lead score/activity thresholds
 */

const fs = require("fs");
const path = require("path");

const BASE_DIR = path.join(__dirname, "..");
const CONFIG_FILE = path.join(BASE_DIR, "config", "triggers.json");
const LOG_FILE = path.join(BASE_DIR, "leads", "trigger-log.jsonl");

const DEFAULT_TRIGGERS = {
  scoreThresholds: {
    hot: 85,
    warm: 70,
    cold: 50
  },
  triggers: [
    {
      id: "hot-lead-alert",
      name: "Hot Lead Alert",
      condition: { field: "score", operator: ">=", value: 85 },
      action: {
        type: "alert",
        channel: "slack",
        message: "🔥 HOT LEAD: {name} score {score}"
      },
      cooldownHours: 24,
      enabled: true
    },
    {
      id: "auto-outreach-tier-a",
      name: "Auto Outreach - Tier A",
      condition: { field: "tier", operator: "==", value: "A" },
      action: {
        type: "queue-outreach",
        sequence: "tier-a-first-touch",
        channel: "linkedin",
        template: "first-touch"
      },
      cooldownHours: 48,
      enabled: true
    },
    {
      id: "auto-outreach-tier-b",
      name: "Auto Outreach - Tier B",
      condition: { field: "tier", operator: "==", value: "B" },
      action: {
        type: "queue-outreach",
        sequence: "tier-b-nurture",
        channel: "email",
        template: "nurture"
      },
      cooldownHours: 72,
      enabled: true
    },
    {
      id: "re-engage-cold",
      name: "Re-engage Cold Lead",
      condition: { 
        field: "status", 
        operator: "==", 
        value: "contacted",
        daysSinceContact: 7
      },
      action: {
        type: "queue-outreach",
        sequence: "re-engage",
        channel: "email",
        template: "checking-in"
      },
      cooldownHours: 168,
      enabled: true
    },
    {
      id: "qualified-upgrade",
      name: "Qualified Status Upgrade",
      condition: { field: "status", operator: "==", value: "qualified" },
      action: {
        type: "update-status",
        status: "proposal"
      },
      cooldownHours: 0,
      enabled: false
    }
  ],
  sequences: {
    "tier-a-first-touch": {
      name: "Tier A First Touch",
      steps: [
        {
          delay: 0,
          type: "dm",
          channel: "linkedin",
          template: "first-touch"
        },
        {
          delay: 3,
          type: "dm",
          channel: "linkedin",
          template: "social-proof"
        },
        {
          delay: 7,
          type: "email",
          channel: "email",
          template: "offer-detail"
        }
      ]
    },
    "tier-b-nurture": {
      name: "Tier B Nurture",
      steps: [
        {
          delay: 0,
          type: "email",
          channel: "email",
          template: "intro"
        },
        {
          delay: 5,
          type: "email",
          channel: "email",
          template: "value-tip"
        },
        {
          delay: 14,
          type: "email",
          channel: "email",
          template: "case-study"
        }
      ]
    },
    "re-engage": {
      name: "Re-engage",
      steps: [
        {
          delay: 0,
          type: "email",
          channel: "email",
          template: "checking-in"
        }
      ]
    }
  }
};

const DM_TEMPLATES = {
  "first-touch": {
    linkedin: [
      "Hey {name} — been watching your {platform} for a bit. {followers} followers, solid engagement. Genuine question: are you monetizing any of that yet, or still figuring it out?",
      "Quick question — you're putting out solid content. Do you have anything set up to capture that attention? Or still in 'figuring it out' mode?"
    ],
    email: "Subject: Quick question about your {platform} growth\n\nHey {name},\n\nBeen following your {platform} journey — {followers} followers is solid traction.\n\nGenuine question: do you have a monetization system set up, or is that still on the roadmap?\n\nBest,\nDerek"
  },
  "social-proof": {
    linkedin: [
      "Btw — I've helped creators similar to you go from where you are to $5-10K/month. Happy to share what's working if useful.",
      "Quick update on what actually works: 3 creators in your niche have hit $10K/mo this year. Happy to share if interested."
    ]
  },
  "offer-detail": {
    email: "Subject: How to monetize {followers} followers\n\nHey {name},\n\nSo here's what I've seen work:\n\n1. Digital product: $47-197, lowest friction\n2. Coaching: $997-2,500, highest margin\n3. Membership: $29-99/mo, recurring\n\nMost start with #1 and upgrade over time.\n\nWhat's your current setup look like?\n\nBest,\nDerek"
  },
  "checking-in": {
    email: "Subject: Checking in\n\nHey {name},\n\nJust checking in — curious how things are going with your monetization?\n\n\nIf helpful, happy to hop on a quick call.\n\n\nBest,\nDerek"
  },
  "intro": {
    email: "Subject: Your {platform} growth\n\nHey {name},\n\nYour {platform} is getting solid traction — {followers} followers isn't small.\n\n\nMost creators at your level leave money on the table because they don't have a backend. Happy to share what's been working if useful.\n\nBest,\nDerek"
  },
  "value-tip": {
    email: "Subject: One thing that works\n\nHey {name},\n\nQuick tip: your email list is your most valuable asset — start capturing emails now, even if it's just a Notion doc.\n\n\nHappy to share more if useful.\n\nBest,\nDerek"
  },
  "case-study": {
    email: "Subject: How creator just like you hit $8K/month\n\nHey {name},\n\nWanted to share — one of my clients who started from similar numbers just hit $8K/month.\n\n\nHappy to hop on a call if you want the playbook.\n\nBest,\nDerek"
  }
};

class OutreachTriggerSystem {
  constructor(config = {}) {
    this.config = { ...DEFAULT_TRIGGERS, ...config };
    this.triggerLog = [];
    this.pendingActions = [];
    this.loaded = false;
  }

  async init() {
    await this.loadConfig();
    return this;
  }

  async loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf8");
      this.config = { ...DEFAULT_TRIGGERS, ...JSON.parse(content) };
    } else {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    }
    this.loaded = true;
  }

  evaluateCondition(condition, lead) {
    const value = lead[condition.field];
    let compareValue = value;
    
    if (condition.daysSinceContact && lead.last_contact) {
      const lastContact = new Date(lead.last_contact);
      const daysSince = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= condition.daysSinceContact;
    }
    
    switch (condition.operator) {
      case ">=":
        return parseInt(value) >= parseInt(condition.value);
      case "<=":
        return parseInt(value) <= parseInt(condition.value);
      case ">":
        return parseInt(value) > parseInt(condition.value);
      case "<":
        return parseInt(value) < parseInt(condition.value);
      case "==":
        return value === condition.value;
      case "!=":
        return value !== condition.value;
      case "contains":
        return String(value).includes(condition.value);
      default:
        return false;
    }
  }

  getCooldownKey(triggerId, leadId) {
    return `${triggerId}:${leadId}`;
  }

  isInCooldown(triggerId, leadId) {
    const trigger = this.config.triggers.find(t => t.id === triggerId);
    if (!trigger || !trigger.cooldownHours) return false;
    
    const key = this.getCooldownKey(triggerId, leadId);
    const logEntry = this.triggerLog.find(l => l.key === key && l.triggerId === triggerId);
    
    if (!logEntry) return false;
    
    const hoursSince = (Date.now() - new Date(logEntry.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSince < trigger.cooldownHours;
  }

  async evaluateTriggers(lead, crm = null) {
    const firedTriggers = [];
    
    for (const trigger of this.config.triggers) {
      if (!trigger.enabled) continue;
      
      if (this.isInCooldown(trigger.id, lead.id)) continue;
      
      if (this.evaluateCondition(trigger.condition, lead)) {
        const fired = await this.fireTrigger(trigger, lead, crm);
        if (fired) {
          firedTriggers.push(fired);
          this.logTriggerEvent(trigger.id, lead.id, "fired", fired);
        }
      }
    }
    
    return firedTriggers;
  }

  async fireTrigger(trigger, lead, crm = null) {
    const action = trigger.action;
    let result = {
      triggerId: trigger.id,
      triggerName: trigger.name,
      leadId: lead.id,
      leadName: lead.name,
      timestamp: new Date().toISOString(),
      action: action.type
    };
    
    switch (action.type) {
      case "alert":
        result.message = action.message
          .replace(/{name}/g, lead.name)
          .replace(/{score}/g, lead.score)
          .replace(/{platform}/g, lead.platform);
        console.log(`\n${result.message}\n`);
        
        if (process.env.SLACK_WEBHOOK_URL) {
          await this._sendSlackAlert(result.message);
        }
        break;
        
      case "queue-outreach":
        result.sequence = action.sequence;
        result.channel = action.channel;
        result.template = action.template;
        result.message = this.renderTemplate(action.template, lead);
        
        this.pendingActions.push(result);
        
        if (crm) {
          crm.addOutreachEvent(lead.id, {
            type: "queued",
            sequence: action.sequence,
            channel: action.channel,
            message: result.message,
            status: "pending"
          });
        }
        
        console.log(`✓ Queued ${action.sequence} for ${lead.name} via ${action.channel}`);
        break;
        
      case "update-status":
        if (crm) {
          crm.updateLead(lead.id, { status: action.status });
          console.log(`✓ Updated ${lead.name} status to ${action.status}`);
        }
        result.newStatus = action.status;
        break;
        
      case "email":
        result.message = this.renderTemplate(action.template || "intro", lead);
        console.log(`Would send email: ${result.message.substring(0, 100)}...`);
        break;
    }
    
    return result;
  }

  renderTemplate(templateName, lead) {
    const templates = DM_TEMPLATES[templateName];
    if (!templates) return "";
    
    let template = templates.linkedin?.[0] || templates.email || "";
    
    if (template.includes("{name}")) {
      const firstName = lead.first_name || lead.name?.split(" ")[0] || "there";
      template = template.replace(/{name}/g, firstName);
    }
    template = template.replace(/{platform}/g, lead.platform || "TikTok");
    template = template.replace(/{followers}/g, lead.followers || "0");
    
    return template;
  }

  async _sendSlackAlert(message) {
    const axios = require("axios");
    try {
      await axios.post(process.env.SLACK_WEBHOOK_URL, {
        text: message,
        username: "Ghost Engine",
        icon_emoji: ":ghost:"
      });
    } catch (error) {
      console.error("Slack alert failed:", error.message);
    }
  }

  logTriggerEvent(triggerId, leadId, event, data = {}) {
    const key = this.getCooldownKey(triggerId, leadId);
    const entry = {
      key,
      triggerId,
      leadId,
      event,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this.triggerLog.push(entry);
    
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  }

  getPendingActions() {
    return this.pendingActions;
  }

  clearPendingActions() {
    this.pendingActions = [];
  }

  getStats() {
    const stats = {
      totalTriggers: this.config.triggers.length,
      enabledTriggers: this.config.triggers.filter(t => t.enabled).length,
      actionsQueued: this.pendingActions.length,
      logEntries: this.triggerLog.length,
      sequences: Object.keys(this.config.sequences).length
    };
    return stats;
  }

  enableTrigger(triggerId) {
    const trigger = this.config.triggers.find(t => t.id === triggerId);
    if (trigger) {
      trigger.enabled = true;
      return true;
    }
    return false;
  }

  disableTrigger(triggerId) {
    const trigger = this.config.triggers.find(t => t.id === triggerId);
    if (trigger) {
      trigger.enabled = false;
      return true;
    }
    return false;
  }

  async saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  getTriggerConfig() {
    return this.config.triggers;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const triggers = new OutreachTriggerSystem();
  await triggers.init();
  
  const { CRMConnector } = await import("./crm-connector.js");
  const crmType = process.env.CRM_TYPE || "json";
  const crm = new CRMConnector({ type: crmType });
  await crm.init();
  
  switch (command) {
    case "evaluate":
      const lead = crm.getLead(args[1]);
      if (!lead) {
        console.log("Lead not found");
        break;
      }
      const fired = await triggers.evaluateTriggers(lead, crm);
      console.log(`Fired ${fired.length} triggers for ${lead.name}`);
      fired.forEach(f => console.log(`  - ${f.triggerName}: ${f.action}`));
      break;
      
    case "evaluate-all":
      const allLeads = crm.listLeads();
      let totalFired = 0;
      for (const lead of allLeads) {
        const fired = await triggers.evaluateTriggers(lead, crm);
        totalFired += fired.length;
      }
      console.log(`Total triggers fired: ${totalFired}`);
      break;
      
    case "list":
      const triggerList = triggers.getTriggerConfig();
      console.log(`\n📋 Configured Triggers (${triggerList.length})\n`);
      triggerList.forEach(t => {
        console.log(`[${t.id}] ${t.name} - ${t.enabled ? "✓" : "✗"} enabled`);
        console.log(`  Condition: ${JSON.stringify(t.condition)}`);
        console.log(`  Action: ${t.action.type}`);
      });
      break;
      
    case "enable":
      const enabled = triggers.enableTrigger(args[1]);
      await triggers.saveConfig();
      console.log(enabled ? `✓ Enabled ${args[1]}` : "Trigger not found");
      break;
      
    case "disable":
      const disabled = triggers.disableTrigger(args[1]);
      await triggers.saveConfig();
      console.log(disabled ? `✓ Disabled ${args[1]}` : "Trigger not found");
      break;
      
    case "stats":
      const stats = triggers.getStats();
      console.log(`
╔══════════════════════════════════════╗
║   OUTREACH TRIGGERS — STATS            ║
╠══════════════════════════════════════╣
║  Triggers: ${stats.totalTriggers.toString().padEnd(24)}║
║  Enabled: ${stats.enabledTriggers.toString().padEnd(24)}║
║  Sequences: ${stats.sequences.toString().padEnd(22)}║
╚══════════════════════════════════════╝
`);
      break;
      
    case "pending":
      const pending = triggers.getPendingActions();
      console.log(`\n📋 Pending Actions (${pending.length})\n`);
      pending.forEach(p => {
        console.log(`[${p.leadName}] ${p.sequence} via ${p.channel}`);
      });
      break;
      
    default:
      console.log(`
Ghost Engine — Outreach Triggers

Usage:
  node lib/outreach-triggers.js evaluate <lead_id>
  node lib/outreach-triggers.js evaluate-all
  node lib/outreach-triggers.js list
  node lib/outreach-triggers.js enable <trigger_id>
  node lib/outreach-triggers.js disable <trigger_id>
  node lib/outreach-triggers.js stats
  node lib/outreach-triggers.js pending
`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OutreachTriggerSystem, DEFAULT_TRIGGERS, DM_TEMPLATES };