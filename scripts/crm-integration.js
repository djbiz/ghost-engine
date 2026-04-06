#!/usr/bin/env node
/**
 * Ghost Engine — CRM Integration Module
 * Supports HubSpot, Salesforce, Pipedrive
 * 
 * Usage:
 *   node crm-integration.js configure <provider> <api_key> [options]
 *   node crm-integration.js sync-to-crm
 *   node crm-integration.js sync-from-crm
 *   node crm-integration.js test-connection
 *   node crm-integration.js status
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONFIG_FILE = path.join(__dirname, '../leads/crm-config.json');
const CRM_FILE = path.join(__dirname, '../leads/crm.csv');
const SYNC_LOG = path.join(__dirname, '../leads/sync-history.jsonl');

const PROVIDERS = {
  hubspot: {
    name: 'HubSpot',
    baseUrl: 'https://api.hubapi.com',
    auth: 'apiKey',
    contactEndpoint: '/crm/v3/objects/contacts',
    properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'lifecyclestage']
  },
  salesforce: {
    name: 'Salesforce',
    baseUrl: null, // Set during OAuth
    auth: 'oauth',
    contactEndpoint: '/services/data/v58.0/sobjects/Contact',
    properties: ['Email', 'FirstName', 'LastName', 'Phone', 'Company']
  },
  pipedrive: {
    name: 'Pipedrive',
    baseUrl: 'https://api.pipedrive.com/v1',
    auth: 'apiKey',
    contactEndpoint: '/persons',
    properties: ['email', 'name', 'phone', 'company_name']
  }
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
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

function saveCRM(rows) {
  if (rows.length === 0) {
    fs.writeFileSync(CRM_FILE, 'id,timestamp,name,platform,followers,email,score,status,last_contact,notes,next_action\n');
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push(headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  });
  fs.writeFileSync(CRM_FILE, lines.join('\n'));
}

function logSync(action, details) {
  ensureFile(SYNC_LOG);
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };
  fs.appendFileSync(SYNC_LOG, JSON.stringify(entry) + '\n');
}

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function hubspotSyncToCRM(config, leads) {
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const lead of leads) {
    try {
      const contactData = {
        properties: {
          email: lead.email,
          firstname: lead.name.split(' ')[0],
          lastname: lead.name.split(' ').slice(1).join(' '),
          phone: lead.phone || '',
          company: lead.platform || '',
          lifecyclestage: mapStatusToLifecycle(lead.status)
        }
      };
      
      const res = await httpRequest({
        hostname: 'api.hubapi.com',
        path: '/crm/v3/objects/contacts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        }
      }, contactData);
      
      if (res.status === 201 || res.status === 409) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${lead.email}: ${res.body.message || 'Unknown error'}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${lead.email}: ${err.message}`);
    }
  }
  
  return results;
}

async function pipedriveSyncToCRM(config, leads) {
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const lead of leads) {
    try {
      const personData = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone || '',
        org_name: lead.platform,
        '5c53c4d6b20a183cf4000003': lead.score // custom field example
      };
      
      const res = await httpRequest({
        hostname: 'api.pipedrive.com',
        path: `/v1/persons?api_token=${config.apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, personData);
      
      if (res.status === 201) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${lead.email}: ${res.body.error || 'Unknown error'}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${lead.email}: ${err.message}`);
    }
  }
  
  return results;
}

async function salesforceSyncToCRM(config, leads) {
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const lead of leads) {
    try {
      const contactData = {
        FirstName: lead.name.split(' ')[0],
        LastName: lead.name.split(' ').slice(1).join(' ') || 'Unknown',
        Email: lead.email,
        Phone: lead.phone || '',
        Company: lead.platform || '',
        Description: `Score: ${lead.score} | Status: ${lead.status} | Notes: ${lead.notes || ''}`
      };
      
      const res = await httpRequest({
        hostname: config.instanceUrl.replace('https://', ''),
        path: '/services/data/v58.0/sobjects/Contact',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.accessToken}`
        }
      }, contactData);
      
      if (res.status === 201) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${lead.email}: ${JSON.stringify(res.body)}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${lead.email}: ${err.message}`);
    }
  }
  
  return results;
}

function mapStatusToLifecycle(status) {
  const mapping = {
    'new': 'subscriber',
    'contacted': 'lead',
    'qualified': 'marketingqualifiedlead',
    'proposal': 'salesqualifiedlead',
    'won': 'customer',
    'lost': 'other'
  };
  return mapping[status] || 'subscriber';
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'configure') {
  const provider = args[1];
  const apiKey = args[2];
  
  if (!provider || !apiKey) {
    console.log('Usage: node crm-integration.js configure <provider> <api_key> [instance_url]');
    console.log('Providers: hubspot, salesforce, pipedrive');
    process.exit(1);
  }
  
  const providerConfig = PROVIDERS[provider.toLowerCase()];
  if (!providerConfig) {
    console.log(`Unknown provider: ${provider}`);
    console.log('Available: hubspot, salesforce, pipedrive');
    process.exit(1);
  }
  
  const config = {
    provider: provider.toLowerCase(),
    providerName: providerConfig.name,
    apiKey: apiKey,
    instanceUrl: args[3] || null,
    configuredAt: new Date().toISOString()
  };
  
  saveConfig(config);
  console.log(`✓ Configured ${providerConfig.name} CRM integration`);
  console.log(`  File: ${CONFIG_FILE}`);
  console.log(`\nNext: node crm-integration.js test-connection`);
}
else if (cmd === 'test-connection') {
  const config = loadConfig();
  if (!config) {
    console.log('CRM not configured. Run: node crm-integration.js configure <provider> <api_key>');
    process.exit(1);
  }
  
  console.log(`Testing connection to ${config.providerName}...`);
  
  if (config.provider === 'hubspot') {
    httpRequest({
      hostname: 'api.hubapi.com',
      path: '/crm/v3/objects/contacts?limit=1',
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    }).then(res => {
      if (res.status === 200) {
        console.log('✓ Connection successful');
      } else {
        console.log(`✗ Connection failed: ${res.status}`);
      }
    }).catch(err => console.log(`✗ Error: ${err.message}`));
  }
  else if (config.provider === 'pipedrive') {
    httpRequest({
      hostname: 'api.pipedrive.com',
      path: `/v1/users/me?api_token=${config.apiKey}`
    }).then(res => {
      if (res.status === 200) {
        console.log('✓ Connection successful');
      } else {
        console.log(`✗ Connection failed: ${res.status}`);
      }
    }).catch(err => console.log(`✗ Error: ${err.message}`));
  }
  else if (config.provider === 'salesforce') {
    if (!config.accessToken) {
      console.log('Salesforce requires OAuth. Please provide access token.');
      process.exit(1);
    }
    console.log('✓ Salesforce requires manual OAuth token setup');
  }
}
else if (cmd === 'sync-to-crm') {
  const config = loadConfig();
  if (!config) {
    console.log('CRM not configured. Run: node crm-integration.js configure <provider> <api_key>');
    process.exit(1);
  }
  
  const leads = loadCRM().filter(l => l.email);
  if (leads.length === 0) {
    console.log('No leads with email to sync');
    process.exit(1);
  }
  
  console.log(`Syncing ${leads.length} leads to ${config.providerName}...`);
  
  let results;
  if (config.provider === 'hubspot') results = hubspotSyncToCRM(config, leads);
  else if (config.provider === 'pipedrive') results = pipedriveSyncToCRM(config, leads);
  else if (config.provider === 'salesforce') results = salesforceSyncToCRM(config, leads);
  
  console.log(`✓ Synced: ${results.success} | Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }
  
  logSync('sync-to-crm', { provider: config.provider, total: leads.length, ...results });
}
else if (cmd === 'status') {
  const config = loadConfig();
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   CRM Integration Status             ║');
  console.log('╠══════════════════════════════════════╣');
  
  if (config) {
    console.log(`║  Provider: ${config.providerName.padEnd(22)}║`);
    console.log(`║  Configured: ${config.configuredAt.split('T')[0].padEnd(19)}║`);
    console.log(`║  Status: Active${' '.repeat(17)}║`);
  } else {
    console.log('║  Status: Not configured               ║');
  }
  
  const leads = loadCRM();
  const withEmail = leads.filter(l => l.email).length;
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Local Leads: ${leads.length.toString().padEnd(22)}║`);
  console.log(`║  With Email: ${withEmail.toString().padEnd(22)}║`);
  console.log('╚══════════════════════════════════════╝\n');
  console.log('Commands:');
  console.log('  configure <provider> <api_key>  - Set up CRM');
  console.log('  test-connection                  - Verify connection');
  console.log('  sync-to-crm                      - Push leads to CRM');
  console.log('  sync-from-crm                    - Pull contacts from CRM');
}
else if (cmd === 'sync-from-crm') {
  console.log('Sync from CRM coming soon - requires implementing contact fetching per provider');
}
else {
  console.log(`
╔════════════════════════════════════════╗
║   Ghost Engine — CRM Integration       ║
╠════════════════════════════════════════╣
║  Configure:                             ║
║    node crm-integration.js configure   ║
║      hubspot <api_key>                 ║
║      pipedrive <api_token>             ║
║      salesforce <access_token>         ║
║        [instance_url]                  ║
║                                        ║
║  Commands:                             ║
║    test-connection   - Verify setup    ║
║    sync-to-crm       - Push leads       ║
║    sync-from-crm     - Pull contacts    ║
║    status            - Show config      ║
╚════════════════════════════════════════╝
`);
}