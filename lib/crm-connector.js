#!/usr/bin/env node
/**
 * Ghost Engine — Modular CRM Connector
 * Supports: JSON/CSV (local), Airtable, Notion, HubSpot
 */

const fs = require("fs");
const path = require("path");

const BASE_DIR = path.join(__dirname, "..");
const DEFAULT_CRM_FILE = path.join(BASE_DIR, "leads", "crm.json");

const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const LEAD_TIERS = ["A", "B", "C"];

const DEFAULT_CONFIG = {
  type: "json",
  file: DEFAULT_CRM_FILE,
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || "",
    baseId: process.env.AIRTABLE_BASE_ID || "",
    tableName: "Leads"
  },
  notion: {
    token: process.env.NOTION_TOKEN || "",
    databaseId: process.env.NOTION_DATABASE_ID || ""
  },
  hubspot: {
    apiKey: process.env.HUBSPOT_API_KEY || ""
  }
};

class CRMConnector {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.leads = [];
    this.loaded = false;
  }

  async init() {
    await this.load();
    return this;
  }

  async load() {
    switch (this.config.type) {
      case "json":
        await this._loadJSON();
        break;
      case "csv":
        await this._loadCSV();
        break;
      case "airtable":
        await this._loadAirtable();
        break;
      case "notion":
        await this._loadNotion();
        break;
      case "hubspot":
        await this._loadHubSpot();
        break;
      default:
        throw new Error(`Unknown CRM type: ${this.config.type}`);
    }
    this.loaded = true;
  }

  async _loadJSON() {
    const file = this.config.file || DEFAULT_CRM_FILE;
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf8");
      this.leads = JSON.parse(data);
    } else {
      this.leads = [];
      await this._saveJSON();
    }
  }

  async _saveJSON() {
    const file = this.config.file || DEFAULT_CRM_FILE;
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(this.leads, null, 2));
  }

  async _loadCSV() {
    const file = this.config.file || DEFAULT_CRM_FILE.replace(".json", ".csv");
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.trim().split("\n");
      if (lines.length <= 1) {
        this.leads = [];
        return;
      }
      const headers = lines[0].split(",").map(h => h.trim());
      this.leads = lines.slice(1).map(line => {
        const values = this._parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] || "");
        return obj;
      });
    } else {
      this.leads = [];
      await this._saveCSV();
    }
  }

  async _saveCSV() {
    const file = this.config.file || DEFAULT_CRM_FILE.replace(".json", ".csv");
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (this.leads.length === 0) return;
    
    const headers = Object.keys(this.leads[0]);
    const lines = [headers.join(",")];
    
    this.leads.forEach(lead => {
      const values = headers.map(h => {
        const val = lead[h] || "";
        return `"${val.toString().replace(/"/g, '""')}"`;
      });
      lines.push(values.join(","));
    });
    
    fs.writeFileSync(file, lines.join("\n"));
  }

  _parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  async _loadAirtable() {
    const axios = require("axios");
    const { airtable } = this.config;
    
    if (!airtable.apiKey || !airtable.baseId) {
      console.warn("Airtable not configured, falling back to JSON");
      this.config.type = "json";
      return this._loadJSON();
    }
    
    const url = `https://api.airtable.com/v0/${airtable.baseId}/${airtable.tableName}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${airtable.apiKey}` }
    });
    
    this.leads = response.data.records.map(record => ({
      id: record.id,
      ...record.fields,
      _source: "airtable"
    }));
  }

  async _loadNotion() {
    const { Client } = require("@notionhq/client");
    const { notion } = this.config;
    
    if (!notion.token || !notion.databaseId) {
      console.warn("Notion not configured, falling back to JSON");
      this.config.type = "json";
      return this._loadJSON();
    }
    
    const client = new Client({ auth: notion.token });
    const response = await client.databases.query({
      database_id: notion.databaseId
    });
    
    this.leads = response.results.map(page => ({
      id: page.id,
      ...this._extractNotionProperties(page.properties),
      _source: "notion"
    }));
  }

  _extractNotionProperties(properties) {
    const result = {};
    Object.entries(properties).forEach(([key, prop]) => {
      switch (prop.type) {
        case "title":
          result[key] = prop.title?.[0]?.plain_text || "";
          break;
        case "rich_text":
          result[key] = prop.rich_text?.[0]?.plain_text || "";
          break;
        case "number":
          result[key] = prop.number || 0;
          break;
        case "select":
          result[key] = prop.select?.name || "";
          break;
        case "multi_select":
          result[key] = prop.multi_select?.map(s => s.name).join(", ") || "";
          break;
        case "date":
          result[key] = prop.date?.start || "";
          break;
        case "checkbox":
          result[key] = prop.checkbox || false;
          break;
        case "email":
          result[key] = prop.email || "";
          break;
        case "url":
          result[key] = prop.url || "";
          break;
        default:
          result[key] = "";
      }
    });
    return result;
  }

  async _loadHubSpot() {
    const axios = require("axios");
    const { hubspot } = this.config;
    
    if (!hubspot.apiKey) {
      console.warn("HubSpot not configured, falling back to JSON");
      this.config.type = "json";
      return this._loadJSON();
    }
    
    const response = await axios.get("https://api.hubapi.com/crm/v3/objects/contacts", {
      headers: { Authorization: `Bearer ${hubspot.apiKey}` }
    });
    
    this.leads = response.data.results.map(contact => ({
      id: contact.id,
      ...contact.properties,
      _source: "hubspot"
    }));
  }

  generateId(prefix = "lead") {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
  }

  getTier(score) {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    return "C";
  }

  calculateScore(lead) {
    if (lead.score !== undefined) return parseInt(lead.score);
    
    let score = 50;
    
    const followers = parseInt(lead.followers) || 0;
    if (followers >= 20000 && followers <= 100000) score += 20;
    else if (followers >= 10000) score += 10;
    else if (followers > 500000) score -= 10;
    
    if (lead.email) score += 10;
    if (lead.platform === "linkedin") score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  createLead(data) {
    const score = this.calculateScore(data);
    const lead = {
      id: data.id || this.generateId(),
      timestamp: data.timestamp || new Date().toISOString(),
      name: data.name || data.first_name + " " + (data.last_name || ""),
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      email: data.email || "",
      phone: data.phone || "",
      platform: data.platform || "tiktok",
      followers: data.followers || "0",
      score: score,
      tier: data.tier || this.getTier(score),
      status: data.status || "new",
      last_contact: data.last_contact || "",
      notes: data.notes || "",
      next_action: data.next_action || "",
      source: data.source || "manual",
      outreach_history: data.outreach_history || [],
      ...data
    };
    
    this.leads.push(lead);
    this._persist();
    return lead;
  }

  getLead(id) {
    return this.leads.find(l => l.id === id);
  }

  updateLead(id, updates) {
    const index = this.leads.findIndex(l => l.id === id);
    if (index === -1) return null;
    
    if (updates.score !== undefined) {
      updates.tier = this.getTier(parseInt(updates.score));
    }
    
    this.leads[index] = { ...this.leads[index], ...updates };
    this._persist();
    return this.leads[index];
  }

  deleteLead(id) {
    const index = this.leads.findIndex(l => l.id === id);
    if (index === -1) return false;
    
    this.leads.splice(index, 1);
    this._persist();
    return true;
  }

  listLeads(filters = {}) {
    let results = [...this.leads];
    
    if (filters.status) {
      results = results.filter(l => l.status === filters.status);
    }
    if (filters.tier) {
      results = results.filter(l => l.tier === filters.tier);
    }
    if (filters.minScore) {
      results = results.filter(l => (parseInt(l.score) || 0) >= filters.minScore);
    }
    if (filters.platform) {
      results = results.filter(l => l.platform === filters.platform);
    }
    if (filters.source) {
      results = results.filter(l => l.source === filters.source);
    }
    
    if (filters.sortBy) {
      const order = filters.sortOrder === "desc" ? -1 : 1;
      results.sort((a, b) => {
        const av = a[filters.sortBy] || 0;
        const bv = b[filters.sortBy] || 0;
        return (av > bv ? 1 : -1) * order;
      });
    }
    
    return results;
  }

  addOutreachEvent(leadId, event) {
    const lead = this.getLead(leadId);
    if (!lead) return null;
    
    const outreachEvent = {
      id: this.generateId("outreach"),
      timestamp: new Date().toISOString(),
      type: event.type || "dm",
      channel: event.channel || "linkedin",
      message: event.message || "",
      response: event.response || "",
      status: event.status || "sent",
      ...event
    };
    
    if (!lead.outreach_history) {
      lead.outreach_history = [];
    }
    lead.outreach_history.push(outreachEvent);
    
    lead.last_contact = outreachEvent.timestamp;
    if (event.status === "replied") {
      lead.status = "qualified";
    }
    
    this._persist();
    return outreachEvent;
  }

  getOutreachHistory(leadId) {
    const lead = this.getLead(leadId);
    return lead?.outreach_history || [];
  }

  getStats() {
    const stats = {
      total: this.leads.length,
      byStatus: {},
      byTier: { A: 0, B: 0, C: 0 },
      avgScore: 0,
      totalFollowers: 0
    };
    
    let totalScore = 0;
    
    this.leads.forEach(lead => {
      stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;
      stats.byTier[lead.tier] = (stats.byTier[lead.tier] || 0) + 1;
      totalScore += parseInt(lead.score) || 0;
      stats.totalFollowers += parseInt(lead.followers) || 0;
    });
    
    stats.avgScore = this.leads.length > 0 ? Math.round(totalScore / this.leads.length) : 0;
    
    return stats;
  }

  async _persist() {
    switch (this.config.type) {
      case "json":
        await this._saveJSON();
        break;
      case "csv":
        await this._saveCSV();
        break;
      case "airtable":
      case "notion":
      case "hubspot":
        console.warn("Cloud CRM sync not implemented yet");
        break;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const crmType = process.env.CRM_TYPE || "json";
  const crm = new CRMConnector({ type: crmType });
  await crm.init();
  
  switch (command) {
    case "add":
      const newLead = crm.createLead({
        name: args[1] || "Unknown",
        email: args[2] || "",
        platform: args[3] || "tiktok",
        followers: args[4] || "0",
        source: args[5] || "manual"
      });
      console.log(`✓ Created lead: ${newLead.name} (${newLead.id}) - Tier ${newLead.tier}`);
      break;
      
    case "list":
      const filters = {};
      if (args[1]) filters.status = args[1];
      if (args[2]) filters.tier = args[2];
      const leads = crm.listLeads(filters);
      console.log(`\n📋 Found ${leads.length} leads\n`);
      leads.forEach(l => {
        console.log(`[${l.id}] ${l.name} | ${l.platform} | ${l.followers} followers | Score: ${l.score} | Tier: ${l.tier} | Status: ${l.status}`);
      });
      break;
      
    case "get":
      const lead = crm.getLead(args[1]);
      if (lead) {
        console.log(JSON.stringify(lead, null, 2));
      } else {
        console.log("Lead not found");
      }
      break;
      
    case "update":
      const [id, field, value] = [args[1], args[2], args[3]];
      const updated = crm.updateLead(id, { [field]: value });
      if (updated) {
        console.log(`✓ Updated ${updated.name}: ${field} = ${value}`);
      } else {
        console.log("Lead not found");
      }
      break;
      
    case "delete":
      const deleted = crm.deleteLead(args[1]);
      console.log(deleted ? "✓ Lead deleted" : "Lead not found");
      break;
      
    case "stats":
      const stats = crm.getStats();
      console.log(`
╔══════════════════════════════════════╗
║   GHOST ENGINE — CRM STATS           ║
╠══════════════════════════════════════╣
║  Total Leads: ${stats.total.toString().padEnd(23)}║
║  By Status:                           ║
${Object.entries(stats.byStatus).map(([s, c]) => `║    ${s.padEnd(12)}: ${c.toString().padEnd(23)}║`).join("\n")}
║  By Tier:                             ║
${Object.entries(stats.byTier).map(([t, c]) => `║    Tier ${t}: ${c.toString().padEnd(23)}║`).join("\n")}
║  Avg Score: ${stats.avgScore.toString().padEnd(24)}║
║  Total Followers: ${stats.totalFollowers.toLocaleString().padEnd(17)}║
╚══════════════════════════════════════╝
`);
      break;
      
    default:
      console.log(`
Ghost Engine — CRM Connector

Usage:
  node lib/crm-connector.js add <name> [email] [platform] [followers] [source]
  node lib/crm-connector.js list [status] [tier]
  node lib/crm-connector.js get <id>
  node lib/crm-connector.js update <id> <field> <value>
  node lib/crm-connector.js delete <id>
  node lib/crm-connector.js stats

Environment Variables:
  CRM_TYPE=json|csv|airtable|notion|hubspot
  AIRTABLE_API_KEY=...
  AIRTABLE_BASE_ID=...
  NOTION_TOKEN=...
  NOTION_DATABASE_ID=...
  HUBSPOT_API_KEY=...
`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CRMConnector, LEAD_STATUSES, LEAD_TIERS };
