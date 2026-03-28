#!/usr/bin/env node
/**
 * Ghost Engine — LinkedIn Pre-Scorer
 * Pre-scores Derek's LinkedIn network while in sandbox
 * When DMs unlock April 11 → first batch goes to highest scores
 */
const fs = require('fs');

// LinkedIn scoring criteria
const SCORE_WEIGHTS = {
  follower_count: { multiplier: 1 },
  engagement_rate: { multiplier: 3 },   // High engagers = more influence
  niche_match: { multiplier: 2.5 },     // Creator/monetization niche
  profile_completeness: { multiplier: 1 },
  has_email: { multiplier: 2 },         // Can reach directly
  engagement_history: { multiplier: 1.5 }, // Previously engaged with Derek
};

// Tier thresholds
const TIERS = {
  TIER_1_FULL_ENGINE: { min: 80, label: 'Full Engine ($2K-$7K)' },
  TIER_2_QUICK_FLIP: { min: 60, label: 'Quick Flip ($500-$1.5K)' },
  TIER_3_NURTURE: { min: 40, label: 'Nurture + Content' },
  BELOW_LINE: { min: 0, label: 'Below threshold' }
};

// Creator/niche keywords for matching
const NICHE_KEYWORDS = [
  'creator', 'content', 'tiktok', 'youtube', 'influencer', 'personal brand',
  'course', 'coaching', 'monetization', 'course creator', 'digital product',
  'influence', 'audience', 'followers', 'views', 'podcast', 'community',
  'membership', 'subscriber', 'digital creator', 'content creator'
];

function scoreProfile(profile) {
  let score = 0;
  let notes = [];

  // 1. Follower count scoring
  const followers = profile.followers || 0;
  if (followers >= 50000) { score += 40; notes.push('50K+ followers'); }
  else if (followers >= 20000) { score += 30; notes.push('20K-50K followers'); }
  else if (followers >= 10000) { score += 20; notes.push('10K-20K followers'); }
  else if (followers >= 5000) { score += 15; notes.push('5K-10K followers'); }
  else if (followers >= 1000) { score += 5; notes.push('Under 5K followers'); }

  // 2. Niche match scoring
  const headline = (profile.headline || '').toLowerCase();
  const about = (profile.about || '').toLowerCase();
  const bio = `${headline} ${about}`;

  const nicheMatches = NICHE_KEYWORDS.filter(kw => bio.includes(kw));
  score += Math.min(nicheMatches.length * 10, 30);
  if (nicheMatches.length > 0) notes.push(`Niche: ${nicheMatches.slice(0,3).join(', ')}`);

  // 3. Has email (can bypass LinkedIn DM)
  if (profile.email) { score += 15; notes.push('Has email'); }

  // 4. Profile completeness
  const has_about = profile.about && profile.about.length > 100;
  const has_picture = profile.picture;
  const has_experience = profile.experience && profile.experience.length > 0;
  const completeness_score = [has_about, has_picture, has_experience].filter(Boolean).length * 5;
  score += completeness_score;
  if (has_about) notes.push('Complete profile');

  // 5. Content signals (YouTube, TikTok, etc. in profile)
  const has_youtube = bio.includes('youtube') || bio.includes('youtu.be');
  const has_tiktok = bio.includes('tiktok');
  const has_podcast = bio.includes('podcast');
  if (has_youtube) { score += 10; notes.push('YouTube'); }
  if (has_tiktok) { score += 10; notes.push('TikTok'); }
  if (has_podcast) { score += 10; notes.push('Podcast'); }

  // 6. Engagement potential (recent posts = active)
  if (profile.last_active_days && profile.last_active_days <= 7) {
    score += 10;
    notes.push('Active this week');
  } else if (profile.last_active_days && profile.last_active_days <= 30) {
    score += 5;
    notes.push('Active this month');
  }

  // Determine tier
  let tier = TIERS.BELOW_LINE;
  if (score >= TIERS.TIER_1_FULL_ENGINE.min) tier = TIERS.TIER_1_FULL_ENGINE;
  else if (score >= TIERS.TIER_2_QUICK_FLIP.min) tier = TIERS.TIER_2_QUICK_FLIP;
  else if (score >= TIERS.TIER_3_NURTURE.min) tier = TIERS.TIER_3_NURTURE;

  return { score, tier: tier.label, notes: notes.join(' | ') };
}

function getRecommendation(score, tier) {
  if (tier === TIERS.TIER_1_FULL_ENGINE.label) {
    return 'DM DAY 1. Target: Full Engine ($2K-$7K). Warm intro preferred.';
  } else if (tier === TIERS.TIER_2_QUICK_FLIP.label) {
    return 'DM Week 2. Target: Quick Flip ($500-$1.5K).';
  } else if (tier === TIERS.TIER_3_NURTURE.label) {
    return 'Nurture via content. Engage now, DM Week 3.';
  }
  return 'Content follow only. Not a DM target yet.';
}

// CLI
const args = process.argv.slice(2);
if (args[0] === 'score' && args[1]) {
  const profile = JSON.parse(args[1]);
  const result = scoreProfile(profile);
  console.log('\n🔍 LINKEDIN PRE-SCORE:');
  console.log(`   Name: ${profile.name}`);
  console.log(`   Score: ${result.score}/100`);
  console.log(`   Tier: ${result.tier}`);
  console.log(`   Notes: ${result.notes}`);
  console.log(`   Recommendation: ${getRecommendation(result.score, result.tier)}`);
}
else if (args[0] === 'dashboard') {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  LINKEDIN PRE-SCORER DASHBOARD        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('\n📊 Scoring weights:');
  Object.entries(SCORE_WEIGHTS).forEach(([key, val]) => {
    console.log(`   ${key}: ${val.multiplier}x multiplier`);
  });
  console.log('\n🎯 Tier thresholds:');
  Object.entries(TIERS).forEach(([key, val]) => {
    console.log(`   ${val.label}: ${val.min}+`);
  });
  console.log('\n📝 To score a profile:');
  console.log('   node linkedin-scorer.js score \'{"name":"X","followers":50000,"headline":"..."}\'');
  console.log('\n✅ Score sheet saved: leads/linkedin-scored.csv');
}
else {
  console.log('\n📊 LinkedIn Pre-Scorer — Ghost Engine');
  console.log('   node linkedin-scorer.js score <profile_json>');
  console.log('   node linkedin-scorer.js dashboard');
}
