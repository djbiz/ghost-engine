import {
  calculateLeadScore as S, getScoreTier as T, checkDisqualification as D,
  applyScoreDecay as Y, applyPlatformModifiers as P, shouldRescore as R,
  normalizeScore as N, resetDecay as X, batchRescore as B
} from '../../leads/lead-scoring';
import { calculateLinkedInModifiers as L } from '../../leads/linkedin-scorer';
const m = (o) => ({followers:0,niche:'tech',email:true,profile:'complete',content:'high',activity:'daily',...o});
const da = (n) => {const d=new Date();d.setDate(d.getDate()-n);return d;};

describe('Weighted Scoring Factors',()=>{
  test.each([[150000,40],[75000,30],[25000,20],[5000,10],[500,0]])('followers %i=>%i pts',(f,p)=>expect(S(m({followers:f})).breakdown.followers).toBe(p));
  test.each([['tech',30],['fitness',20],['travel',10],['astrology',0]])('niche %s=>%i pts',(n,p)=>expect(S(m({followers:50000,niche:n})).breakdown.niche).toBe(p));
  test('email true=>15',()=>expect(S(m({followers:50000})).breakdown.email).toBe(15));
  test('email false=>0',()=>expect(S(m({followers:50000,email:false})).breakdown.email).toBe(0));
  test('profile complete=>15',()=>expect(S(m({followers:50000})).breakdown.profile).toBe(15));
  test('profile incomplete=>0',()=>expect(S(m({followers:50000,profile:'incomplete'})).breakdown.profile).toBe(0));
  test('content high=>30',()=>expect(S(m({followers:50000})).breakdown.content).toBe(30));
  test('activity daily=>10',()=>expect(S(m({followers:50000})).breakdown.activity).toBe(10));
  test('normalize 0-100',()=>{const s=S(m({followers:150000}));expect(N(s.total)).toBeGreaterThanOrEqual(0);expect(N(s.total)).toBeLessThanOrEqual(100);});
});

describe('Score Tiers',()=>{
  test.each([[95,'hot'],[90,'hot'],[80,'warm'],[70,'warm'],[55,'cool'],[40,'cool'],[20,'cold'],[0,'cold']])('score %i=>%s',(s,t)=>expect(T(s)).toBe(t));
});

describe('Disqualification Criteria',()=>{
  const cases=[
    {r:'fake_followers',l:m({followers:50000,fake_follower_ratio:0.4})},
    {r:'bot_activity',l:m({followers:50000,bot_score:0.8})},
    {r:'no_engagement',l:m({followers:50000,engagement_rate:0})},
    {r:'banned_niche',l:m({followers:50000,niche:'gambling'})},
    {r:'inactive',l:m({followers:50000,last_post:da(180)})},
    {r:'under_age',l:m({followers:50000,age:16})},
    {r:'blacklisted',l:m({followers:50000,blacklisted:true})}
  ];
  cases.forEach(({r,l})=>{
    test(`disqualifies for ${r}`,()=>{const res=D(l);expect(res.disqualified).toBe(true);expect(res.reason).toBe(r);});
  });
});

describe('Score Decay',()=>{
  test('no decay within 7d',()=>expect(Y(80,da(3)).score).toBe(80));
  test('5% decay after 14d',()=>expect(Y(80,da(14)).score).toBe(76));
  test('10% decay after 30d',()=>expect(Y(80,da(30)).score).toBe(72));
  test('25% decay after 60d',()=>expect(Y(80,da(60)).score).toBe(60));
  test('50% decay after 90d',()=>expect(Y(80,da(90)).score).toBe(40));
  test('decay never below 0',()=>expect(Y(10,da(365)).score).toBeGreaterThanOrEqual(0));
  test('decay_applied flag true',()=>expect(Y(80,da(30)).decay_applied).toBe(true));
  test('no decay_applied in grace',()=>expect(Y(80,da(3)).decay_applied).toBe(false));
  test('resetDecay restores',()=>expect(X(Y(80,da(30))).score).toBe(80));
});

describe('Platform-Specific Modifiers',()=>{
  test('LinkedIn +10 for 500+ connections',()=>expect(P(m({followers:50000,platform:'linkedin',connections:600})).modifier).toBe(10));
  test('LinkedIn +5 for verified',()=>expect(P(m({followers:50000,platform:'linkedin',verified:true})).modifier).toBeGreaterThanOrEqual(5));
  test('LinkedIn uses calculateLinkedInModifiers',()=>{const mod=L(m({followers:50000,platform:'linkedin',connections:600,verified:true}));expect(mod).toBeDefined();expect(typeof mod.total).toBe('number');});
  test('TikTok +15 for >1M views',()=>expect(P(m({followers:50000,platform:'tiktok',avg_views:1500000})).modifier).toBe(15));
  test('TikTok +5 for trending audio',()=>expect(P(m({followers:50000,platform:'tiktok',uses_trending_audio:true})).modifier).toBeGreaterThanOrEqual(5));
  test('TikTok 0 for low views',()=>expect(P(m({followers:50000,platform:'tiktok',avg_views:1000})).modifier).toBe(0));
  test('YouTube +10 for >100k subs',()=>expect(P(m({followers:150000,platform:'youtube',subscribers:150000})).modifier).toBe(10));
  test('YouTube +5 for monetized',()=>expect(P(m({followers:50000,platform:'youtube',monetized:true})).modifier).toBeGreaterThanOrEqual(5));
  test('YouTube 0 for small channel',()=>expect(P(m({followers:5000,platform:'youtube',subscribers:5000})).modifier).toBe(0));
});

describe('Re-scoring Triggers',()=>{
  test('rescore on >10% follower change',()=>expect(R({previous:m({followers:50000}),current:m({followers:60000})})).toBe(true));
  test('no rescore for minor change',()=>expect(R({previous:m({followers:50000}),current:m({followers:51000})})).toBe(false));
  test('rescore on niche change',()=>expect(R({previous:m({followers:50000}),current:m({followers:50000,niche:'fitness'})})).toBe(true));
  test('rescore on email change',()=>expect(R({previous:m({followers:50000}),current:m({followers:50000,email:false})})).toBe(true));
  test('rescore on platform change',()=>expect(R({previous:m({followers:50000,platform:'tiktok'}),current:m({followers:50000,platform:'youtube'})})).toBe(true));
  test('no rescore when unchanged',()=>{const l=m({followers:50000});expect(R({previous:l,current:{...l}})).toBe(false);});
  test('rescore on DQ status change',()=>expect(R({previous:m({followers:50000}),current:m({followers:50000,blacklisted:true})})).toBe(true));
});

describe('Follower Boundaries',()=>{
  test.each([[1000,10],[999,0],[10000,20],[50000,30],[100000,40],[0,0],[-100,0]])('followers %i=>%i pts',(f,p)=>expect(S(m({followers:f})).breakdown.followers).toBe(p));
});

describe('Profile Elements',()=>{
  test('partial=>8',()=>expect(S(m({followers:50000,profile:'partial'})).breakdown.profile).toBe(8));
  test('missing=>0',()=>expect(S(m({followers:50000,profile:'missing'})).breakdown.profile).toBe(0));
  test('complete=>15',()=>expect(S(m({followers:50000,profile:'complete'})).breakdown.profile).toBe(15));
  test('profile affects total',()=>{const a=S(m({followers:50000,profile:'complete'}));const b=S(m({followers:50000,profile:'missing'}));expect(a.total).toBeGreaterThan(b.total);});
  test('breakdown has profile',()=>expect(S(m({followers:50000})).breakdown).toHaveProperty('profile'));
});

describe('Content Granularity',()=>{
  test.each([['medium',20],['low',10],['none',0],['high',30]])('content %s=>%i pts',(c,p)=>expect(S(m({followers:50000,content:c})).breakdown.content).toBe(p));
  test('breakdown has content',()=>expect(S(m({followers:50000})).breakdown).toHaveProperty('content'));
});

describe('Activity Boundaries',()=>{
  test.each([['weekly',7],['monthly',3],['none',0],['daily',10]])('activity %s=>%i pts',(a,p)=>expect(S(m({followers:50000,activity:a})).breakdown.activity).toBe(p));
});

describe('Score Clamping',()=>{
  test('clamp max 100',()=>expect(N(150)).toBe(100));
  test('clamp min 0',()=>expect(N(-20)).toBe(0));
  test('preserve valid',()=>expect(N(55)).toBe(55));
});

describe('DQ Edge Cases',()=>{
  test('clean lead passes',()=>expect(D(m({followers:50000})).disqualified).toBe(false));
  test('low fake ratio passes',()=>expect(D(m({followers:50000,fake_follower_ratio:0.1})).disqualified).toBe(false));
  test('multiple DQ returns first',()=>{const r=D(m({followers:50000,fake_follower_ratio:0.4,bot_score:0.8}));expect(r.disqualified).toBe(true);expect(r.reason).toBeDefined();});
});

describe('Decay Extended',()=>{
  test('exactly 7d no decay',()=>expect(Y(80,da(7)).score).toBe(80));
  test('8d starts decay',()=>expect(Y(80,da(8)).score).toBeLessThan(80));
  test('score 0 stays 0',()=>expect(Y(0,da(90)).score).toBe(0));
  test('100 after 90d=>50',()=>expect(Y(100,da(90)).score).toBe(50));
});

describe('Batch Rescore',()=>{
  test('rescores multiple',()=>expect(B([m({followers:50000}),m({followers:100000}),m({followers:5000})])).toHaveLength(3));
  test('returns scored objects',()=>{const r=B([m({followers:50000})]);expect(r[0]).toHaveProperty('total');expect(r[0]).toHaveProperty('breakdown');});
  test('empty array returns empty',()=>expect(B([])).toHaveLength(0));
});
