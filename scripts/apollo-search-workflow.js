#!/usr/bin/env node
/**
 * Ghost Engine — Apollo Search Workflow
 * Step-by-step Apollo search for creator leads
 * Works on free Apollo tier
 * 
 * Usage: node apollo-search-workflow.js
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const q = (p) => new Promise((res) => rl.question(p, res));

const TIKTOK_CREATORS = {
  search: "site:linkedin.com/in TikTok OR \"TikTok\" creator \"digital product\" OR \"course\" OR \"infoproduct\"",
  titles: ["Creator", "Content Creator", "TikTok Creator", "Influencer", "Digital Creator"],
  note: "Target: 10K-500K followers, posts about building in public or digital products"
};

const YOUTUBE_CREATORS = {
  search: "site:linkedin.com/in YouTube OR \"YouTube\" creator \"digital product\" OR \"course\" OR \"member\"",
  titles: ["YouTube Creator", "Content Creator", "Video Creator"],
  note: "Target: YouTubers with memberships or digital products"
};

const INFO_PRODUCT_CREATORS = {
  search: "site:linkedin.com/in \"digital product\" OR \"course creator\" OR \"infoproduct\" OR \"online course\"",
  titles: ["Founder", "Creator", "Course Creator", "Coach"],
  note: "Target: Already selling but undermonetized"
};

const AUDIENCE_BUILDEFS = {
  search: "site:linkedin.com/in \"building in public\" OR \"audience first\" OR \"creator economy\"",
  titles: ["Founder", "Creator", "Growth", "Content"],
  note: "Target: Building audience, no product yet"
};

async function runApolloWorkflow() {
  console.log('\n===========================================');
  console.log('   GHOST ENGINE — APOLLO LEAD HUNT');
  console.log('===========================================');
  console.log('\nApollo Free Tier Search Guide');
  console.log('----------------------------\n');
  
  console.log('STEP 1: Go to https://app.apollo.io');
  console.log('STEP 2: Click "People" search\n');
  
  const answers = await q('Which segment? (1=TikTok, 2=YouTube, 3=InfoProduct, 4=AudienceBuilder): ');
  const segments = {1: TIKTOK_CREATORS, 2: YOUTUBE_CREATORS, 3: INFO_PRODUCT_CREATORS, 4: AUDIENCE_BUILDEFS};
  const seg = segments[parseInt(answers)] || TIKTOK_CREATORS;
  
  console.log('\n===========================================');
  console.log(`   SEARCH: ${seg.search}`);
  console.log('===========================================');
  console.log('\nIn Apollo, paste this search term:');
  console.log(`"${seg.search}"\n`);
  
  console.log('APOLLO FILTER SETTINGS:');
  console.log('- Titles: ' + seg.titles.join(', '));
  console.log('- Location: United States (or your target)');
  console.log('- Keywords: ' + seg.note);
  console.log('- Department: None');
  console.log('- Seniority: Founder, Owner, Co-Founder\n');
  
  console.log('Save as: Ghost-Engine-' + (answers === '1' ? 'TikTok' : answers === '2' ? 'YouTube' : answers === '3' ? 'InfoProduct' : 'AudienceBuilder'));
  console.log('\nAfter saving, EXPORT the contacts as CSV');
  console.log('Save to: /home/workspace/Ghost-Monitization-Engine/leads/apollo-[segment]-[date].csv\n');
  
  console.log('===========================================');
  console.log('   ADD TO CRM');
  console.log('===========================================');
  console.log('\nAfter export, run:');
  console.log('node /home/workspace/Ghost-Monitization-Engine/scripts/outreach-engine.js import-apollo leads/apollo-[file].csv');
  console.log('\nZo will:');
  console.log('- Import all leads');
  console.log('- Score each by followers + engagement signals');
  console.log('- Tag by tier (Quick Flip / Full Engine / Ghost Partner)');
  console.log('- Queue for April 11 DM launch\n');
  
  rl.close();
}

runApolloWorkflow();
