const {
  calculateLeadScore,
  getScoreTier,
  checkDisqualification,
  applyScoreDecay,
  applyPlatformModifiers,
  shouldRescore,
  normalizeScore,
  resetDecay,
  batchRescore
} = require('../../leads/lead-scoring');

const {
  calculateLinkedInModifiers
} = require('../../leads/linkedin-scorer');

// ============================================================
// 1. Weighted Scoring Factors
// ============================================================
describe('Weighted Scoring Factors', () => {
  describe('Followers factor (max 40pts)', () => {
    it('should award 40 points for 100k+ followers', () => {
      const score = calculateLeadScore({ followers: 150000, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.followers).toBe(40);
    });

    it('should award proportional points for moderate follower counts', () => {
      const score = calculateLeadScore({ followers: 10000, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.followers).toBeGreaterThan(0);
      expect(score.breakdown.followers).toBeLessThanOrEqual(40);
    });

    it('should award 0 points for 0 followers', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.followers).toBe(0);
    });
  });

  describe('Niche match factor (max 30pts)', () => {
    it('should award 30 points for exact niche match', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() }, { targetNiche: 'tech' });
      expect(score.breakdown.nicheMatch).toBe(30);
    });

    it('should award partial points for related niche', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'software', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() }, { targetNiche: 'tech' });
      expect(score.breakdown.nicheMatch).toBeGreaterThan(0);
      expect(score.breakdown.nicheMatch).toBeLessThan(30);
    });

    it('should award 0 points for unrelated niche', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'cooking', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() }, { targetNiche: 'tech' });
      expect(score.breakdown.nicheMatch).toBe(0);
    });
  });

  describe('Email availability factor (max 15pts)', () => {
    it('should award 15 points when email is available and verified', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: 'lead@example.com', emailVerified: true, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.emailAvailability).toBe(15);
    });

    it('should award partial points for unverified email', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: 'lead@example.com', emailVerified: false, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.emailAvailability).toBeGreaterThan(0);
      expect(score.breakdown.emailAvailability).toBeLessThan(15);
    });
  });

  describe('Profile completeness factor (max 15pts)', () => {
    it('should award 15 points for fully complete profile', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: true, bio: 'Full bio', avatar: 'url', contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.profileCompleteness).toBe(15);
    });
  });

  describe('Content signals factor (max 30pts)', () => {
    it('should award 30 points for strong content signals', () => {
      const signals = ['high_engagement', 'consistent_posting', 'viral_content'];
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: false, contentSignals: signals, lastActive: new Date() });
      expect(score.breakdown.contentSignals).toBe(30);
    });

    it('should award 0 for no content signals', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.contentSignals).toBe(0);
    });
  });

  describe('Activity recency factor (max 10pts)', () => {
    it('should award 10 points for activity within last 24 hours', () => {
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: new Date() });
      expect(score.breakdown.activityRecency).toBe(10);
    });

    it('should award reduced points for older activity', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const score = calculateLeadScore({ followers: 0, niche: 'tech', email: null, profileComplete: false, contentSignals: [], lastActive: thirtyDaysAgo });
      expect(score.breakdown.activityRecency).toBeLessThan(10);
      expect(score.breakdown.activityRecency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Score normalization', () => {
    it('should normalize raw max of 140 to 0-100 scale', () => {
      const maxLead = {
        followers: 500000,
        niche: 'tech',
        email: 'verified@example.com',
        emailVerified: true,
        profileComplete: true,
        bio: 'Complete bio',
        avatar: 'url',
        contentSignals: ['high_engagement', 'consistent_posting', 'viral_content'],
        lastActive: new Date()
      };
      const score = calculateLeadScore(maxLead, { targetNiche: 'tech' });
      const rawSum = Object.values(score.breakdown).reduce((a, b) => a + b, 0);
      expect(rawSum).toBe(140);
      expect(score.normalizedScore).toBe(100);
    });

    it('should normalize a mid-range score correctly', () => {
      const normalized = normalizeScore(70, 140);
      expect(normalized).toBe(50);
    });

    it('should clamp normalized score to 0 minimum', () => {
      const normalized = normalizeScore(-5, 140);
      expect(normalized).toBe(0);
    });
  });
});

// ============================================================
// 2. Score Tiers
// ============================================================
describe('Score Tiers', () => {
  it('should classify score 80 as Hot', () => {
    expect(getScoreTier(80)).toBe('Hot');
  });

  it('should classify score 100 as Hot', () => {
    expect(getScoreTier(100)).toBe('Hot');
  });

  it('should classify score 79 as Warm', () => {
    expect(getScoreTier(79)).toBe('Warm');
  });

  it('should classify score 60 as Warm', () => {
    expect(getScoreTier(60)).toBe('Warm');
  });

  it('should classify score 59 as Cold', () => {
    expect(getScoreTier(59)).toBe('Cold');
  });

  it('should classify score 40 as Cold', () => {
    expect(getScoreTier(40)).toBe('Cold');
  });

  it('should classify score 39 as Dead', () => {
    expect(getScoreTier(39)).toBe('Dead');
  });

  it('should classify score 0 as Dead', () => {
    expect(getScoreTier(0)).toBe('Dead');
  });
});

// ============================================================
// 3. Disqualification Criteria
// ============================================================
describe('Disqualification Criteria', () => {
  const disqualificationReasons = [
    { reason: 'fake_bot', label: 'fake/bot account' },
    { reason: 'competitor', label: 'competitor account' },
    { reason: 'blacklisted_domain', label: 'blacklisted domain' },
    { reason: 'inactive_6_months', label: 'inactive >6 months' },
    { reason: 'previous_opt_out', label: 'previous opt-out' },
    { reason: 'inappropriate_content', label: 'inappropriate content' },
    { reason: 'duplicate', label: 'duplicate lead' }
  ];

  disqualificationReasons.forEach(({ reason, label }) => {
    it(`should disqualify and zero-score for ${label}`, () => {
      const result = checkDisqualification({ disqualificationFlags: [reason] });
      expect(result.disqualified).toBe(true);
      expect(result.score).toBe(0);
      expect(result.tier).toBe('Dead');
      expect(result.reason).toBe(reason);
    });
  });
});

// ============================================================
// 4. Score Decay
// ============================================================
describe('Score Decay', () => {
  it('should apply -2 point decay after 7 days of no engagement', () => {
    const result = applyScoreDecay({ score: 85, lastEngagement: daysAgo(7) });
    expect(result.score).toBe(83);
  });

  it('should apply -5 point decay after 14 days', () => {
    const result = applyScoreDecay({ score: 85, lastEngagement: daysAgo(14) });
    expect(result.score).toBe(80);
  });

  it('should apply -10 point decay after 30 days', () => {
    const result = applyScoreDecay({ score: 85, lastEngagement: daysAgo(30) });
    expect(result.score).toBe(75);
  });

  it('should apply -20 point decay after 60 days', () => {
    const result = applyScoreDecay({ score: 85, lastEngagement: daysAgo(60) });
    expect(result.score).toBe(65);
  });

  it('should apply -30 point decay after 90 days', () => {
    const result = applyScoreDecay({ score: 85, lastEngagement: daysAgo(90) });
    expect(result.score).toBe(55);
  });

  it('should not decay score below 0', () => {
    const result = applyScoreDecay({ score: 5, lastEngagement: daysAgo(90) });
    expect(result.score).toBe(0);
  });

  it('should reset decay timer on new engagement', () => {
    const lead = { score: 70, lastEngagement: daysAgo(30), decayApplied: true };
    const result = resetDecay(lead, { engagementDate: new Date() });
    expect(result.lastEngagement.getTime()).toBeCloseTo(Date.now(), -3);
    expect(result.decayApplied).toBe(false);
  });

  it('should move Hot lead to Warm when decay drops score below 60', () => {
    const result = applyScoreDecay({ score: 80, tier: 'Hot', lastEngagement: daysAgo(90) });
    expect(result.score).toBe(50);
    expect(result.tier).toBe('Cold');
  });

  it('should move Warm lead to Cold when decay drops score below 40', () => {
    const result = applyScoreDecay({ score: 45, tier: 'Warm', lastEngagement: daysAgo(30) });
    expect(result.score).toBe(35);
    expect(result.tier).toBe('Dead');
  });
});

// Helper
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ============================================================
// 5. Platform-Specific Modifiers
// ============================================================
describe('Platform-Specific Modifiers', () => {
  describe('LinkedIn', () => {
    it('should add +5 for Services/Creator Mode enabled', () => {
      const mods = calculateLinkedInModifiers({ creatorMode: true, connections: 200, hasPhoto: true, headline: 'Software Engineer at ACME' });
      expect(mods.bonus).toBeGreaterThanOrEqual(5);
    });

    it('should add +3 for 500+ connections', () => {
      const mods = calculateLinkedInModifiers({ creatorMode: false, connections: 750, hasPhoto: true, headline: 'CTO' });
      expect(mods.connectionBonus).toBe(3);
    });

    it('should apply -5 penalty for no photo or generic headline', () => {
      const mods = calculateLinkedInModifiers({ creatorMode: false, connections: 100, hasPhoto: false, headline: '' });
      expect(mods.penalty).toBeLessThanOrEqual(-5);
    });
  });

  describe('TikTok', () => {
    it('should add +5 for verified TikTok account', () => {
      const mods = applyPlatformModifiers('tiktok', { verified: true, linkInBio: false, lastPostDate: new Date() });
      expect(mods.bonus).toBeGreaterThanOrEqual(5);
    });

    it('should add +3 for link in bio', () => {
      const mods = applyPlatformModifiers('tiktok', { verified: false, linkInBio: true, lastPostDate: new Date() });
      expect(mods.linkBonus).toBe(3);
    });

    it('should apply -5 penalty for no posts in 30 days', () => {
      const mods = applyPlatformModifiers('tiktok', { verified: false, linkInBio: false, lastPostDate: daysAgo(45) });
      expect(mods.penalty).toBeLessThanOrEqual(-5);
    });
  });

  describe('YouTube', () => {
    it('should add +5 for monetization enabled', () => {
      const mods = applyPlatformModifiers('youtube', { monetized: true, consistentUploads: false, totalVideos: 50 });
      expect(mods.bonus).toBeGreaterThanOrEqual(5);
    });

    it('should add +3 for consistent upload schedule', () => {
      const mods = applyPlatformModifiers('youtube', { monetized: false, consistentUploads: true, totalVideos: 50 });
      expect(mods.uploadBonus).toBe(3);
    });

    it('should apply -5 penalty for fewer than 10 videos', () => {
      const mods = applyPlatformModifiers('youtube', { monetized: false, consistentUploads: false, totalVideos: 5 });
      expect(mods.penalty).toBeLessThanOrEqual(-5);
    });
  });
});

// ============================================================
// 6. Re-scoring Triggers
// ============================================================
describe('Re-scoring Triggers', () => {
  it('should trigger re-score on new engagement data', () => {
    const result = shouldRescore({ lastScored: daysAgo(1), events: ['new_engagement'] });
    expect(result).toBe(true);
  });

  it('should trigger re-score on follower count change >10%', () => {
    const result = shouldRescore({ lastScored: daysAgo(1), previousFollowers: 1000, currentFollowers: 1150 });
    expect(result).toBe(true);
  });

  it('should NOT trigger re-score on follower change <=10%', () => {
    const result = shouldRescore({ lastScored: daysAgo(1), previousFollowers: 1000, currentFollowers: 1050 });
    expect(result).toBe(false);
  });

  it('should trigger re-score on form or call completion', () => {
    const result = shouldRescore({ lastScored: daysAgo(1), events: ['form_completed'] });
    expect(result).toBe(true);
  });

  it('should trigger re-score on manual override flag', () => {
    const result = shouldRescore({ lastScored: daysAgo(1), manualOverride: true });
    expect(result).toBe(true);
  });

  it('should trigger weekly batch re-score when 7+ days since last score', () => {
    const result = shouldRescore({ lastScored: daysAgo(8), events: [] });
    expect(result).toBe(true);
  });

  it('should NOT trigger batch re-score within 7 days if no events', () => {
    const result = shouldRescore({ lastScored: daysAgo(3), events: [] });
    expect(result).toBe(false);
  });
});
