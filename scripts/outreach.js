#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Outreach Engine
 * Finds creators who are posting but not monetizing
 */

const https = require("https");
const http = require("http");

// Configuration
const CONFIG = {
  // Apollo API key — set via APOLLO_API_KEY env var
  // Free tier: 50 searches/month
  apolloApiKey: process.env.APOLLO_API_KEY || "",
  
  // Target criteria
  targetPlatform: "tiktok", // tiktok, linkedin, youtube
  minFollowers: 5000,
  maxFollowers: 500000,
  
  // Output
  outputFile: "./leads/prospects.csv"
};

const PLATFORMS = {
  tiktok: {
    name: "TikTok",
    followersField: ".followers_count",
    bioFields: ["headline", "bio"],
    noMonetizeSignals: ["no link in bio", "link in bio → no product", "selling nothing"]
  },
  linkedin: {
    name: "LinkedIn", 
    followersField: "connections", // approximate
    bioFields: ["headline", "summary"],
    noMonetizeSignals: ["open to work", "no offer", "consulting but no pricing"]
  },
  youtube: {
    name: "YouTube",
    subscribersField: "subscriber_count",
    noMonetizeSignals: ["no description link", "no merchandise", "no membership"]
  }
};

/**
 * Search Apollo for creators matching criteria
 */
async function searchApollo(query, page = 1) {
  const options = {
    hostname: "api.apollo.io",
    path: `/v1/contacts/search?api_key=${CONFIG.apolloApiKey}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  };

  const body = JSON.stringify({
    "page": page,
    "per_page": 25,
    "q_keywords": query,
    "contact_filter": {
      "q_keywords": query
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Score a lead based on monetization readiness
 * Higher score = more ready to be approached
 */
function scoreLead(lead) {
  let score = 50; // base
  
  // Follower count scoring
  const followers = lead.followers_count || 0;
  if (followers >= 20000 && followers <= 100000) score += 20;
  else if (followers >= 10000 && followers < 20000) score += 10;
  else if (followers > 500000) score -= 10;
  
  // Engagement signals
  if (lead.engagement_rate && lead.engagement_rate > 3) score += 15;
  
  // Monetization gap signals
  if (!lead.email) score -= 5; // harder to reach
  if (lead.bio && /DM for promo|collab|sponsorship/i.test(lead.bio)) score += 10;
  if (lead.bio && /link in bio|check link/i.test(lead.bio)) score -= 15; // has link but probably not monetizing
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate personalized DM for a lead
 */
function generateDM(lead, platform) {
  const firstName = lead.first_name || "there";
  const first = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  
  const platformConfig = PLATFORMS[platform];
  const followerCount = lead.followers_count || 0;
  const formattedFollowers = followerCount >= 1000 
    ? `${(followerCount/1000).toFixed(0)}K` 
    : followerCount;
  
  const dmTemplates = {
    tiktok: [
      `Hey ${first} — been watching your TikTok for a bit. ${formattedFollowers} followers, solid engagement on your last few posts. Genuine question: are you monetizing any of that yet, or still figuring it out?`,
      `Quick question — you're putting out solid content and getting good traction. Do you have anything set up to actually capture that attention? Or still in "figuring it out" mode?`
    ],
    linkedin: [
      `Hey ${first} — your posts are getting solid engagement. Curious — do you have an offer or product built out, or are you still building in public?`,
      `Genuine question — you're clearly building something meaningful here. Is there a monetization component yet, or is that still on the roadmap?`
    ],
    youtube: [
      `Hey ${first} — been watching your channel. Solid growth on your subscriber count. Question: do you have a backend set up to actually monetize those views? Or is that still ahead?`
    ]
  };
  
  const templates = dmTemplates[platform];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Export leads to CSV
 */
function exportToCSV(leads, filename) {
  const fs = require("fs");
  const headers = ["first_name", "last_name", "email", "followers_count", "platform", "monetization_score", "dm_message", "status"];
  
  const rows = leads.map(lead => [
    lead.first_name || "",
    lead.last_name || "",
    lead.email || "",
    lead.followers_count || 0,
    lead.platform || "tiktok",
    lead.score || 0,
    `"${lead.dm}"`,
    "new"
  ]);
  
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  fs.writeFileSync(filename, csv);
  console.log(`✓ Exported ${leads.length} leads to ${filename}`);
}

module.exports = { searchApollo, scoreLead, generateDM, exportToCSV };
