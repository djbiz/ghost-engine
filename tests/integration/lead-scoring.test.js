const{calculateLeadScore:C,getScoreTier:T,checkDisqualification:DQ,applyScoreDecay:SD,shouldRescore:SR,normalizeScore:NS,resetDecay:RD}=require('../../leads/lead-scoring');
const N=new Date(),A=d=>new Date(Date.now()-d*864e5);
const B={followers:0,niche:'tech',email:null,profileComplete:false,contentSignals:[],lastActive:N,flags:[]};
const s=(o,t)=>C({...B,...o},t);

describe('Follower Boundaries',()=>{
it('0 at 0',()=>{expect(s({followers:0}).breakdown.followers).toBe(0)});
it('minimal at 1',()=>{const r=s({followers:1});expect(r.breakdown.followers).toBeGreaterThanOrEqual(0);expect(r.breakdown.followers).toBeLessThanOrEqual(1)});
it('defined at 999',()=>{expect(s({followers:999}).breakdown.followers).toBeDefined()});
it('>0 at 1000',()=>{expect(s({followers:1000}).breakdown.followers).toBeGreaterThan(0)});
it('9999<10000',()=>{expect(s({followers:9999}).breakdown.followers).toBeLessThan(s({followers:10000}).breakdown.followers)});
it('50k>20pts',()=>{expect(s({followers:50000}).breakdown.followers).toBeGreaterThan(20)});
it('caps 100k at 40',()=>{expect(s({followers:100000}).breakdown.followers).toBe(40)});
it('negative=0',()=>{expect(s({followers:-100}).breakdown.followers).toBe(0)});
});

describe('Profile Elements',()=>{
it('bio boosts',()=>{expect(s({profileComplete:true,bio:'Tech leader'}).total).toBeGreaterThan(s({profileComplete:false}).total)});
it('no avatar ok',()=>{expect(s({hasPhoto:false}).total).toBeDefined()});
it('null website ok',()=>{expect(s({website:null}).total).toBeDefined()});
it('empty name ok',()=>{expect(s({displayName:''}).total).toBeDefined()});
it('email formats',()=>{expect(s({email:'u+t@s.d.co.uk',emailVerified:true}).breakdown.emailAvailability).toBe(15)});
});

describe('Content Signals',()=>{
it('single signal',()=>{const r=s({contentSignals:['high_engagement']});expect(r.breakdown.contentSignals).toBeGreaterThan(0);expect(r.breakdown.contentSignals).toBeLessThanOrEqual(15)});
it('caps at 15',()=>{expect(s({contentSignals:['high_engagement','consistent_posting','viral_content','brand_safe','niche_authority']}).breakdown.contentSignals).toBeLessThanOrEqual(15)});
it('empty=0',()=>{expect(s({contentSignals:[]}).breakdown.contentSignals).toBe(0)});
it('undefined=0',()=>{expect(s({contentSignals:undefined}).breakdown.contentSignals).toBe(0)});
it('duplicates capped',()=>{expect(s({contentSignals:['high_engagement','high_engagement']}).breakdown.contentSignals).toBeLessThanOrEqual(15)});
});

describe('Decay',()=>{
it('no decay 1d',()=>{expect(SD(80,A(1)).score).toBe(80)});
it('decays 45d',()=>{expect(SD(80,A(45)).score).toBeLessThan(80)});
it('more decay 120d',()=>{expect(SD(80,A(120)).score).toBeLessThan(SD(80,A(45)).score)});
it('floor>=0',()=>{expect(SD(80,A(1000)).score).toBeGreaterThanOrEqual(0)});
it('reset clears flag',()=>{expect(RD({score:50,decayApplied:true}).decayApplied).toBe(false)});
it('rescore after 30d',()=>{expect(SR({lastScored:A(30)})).toBe(true)});
it('no rescore recent',()=>{expect(SR({lastScored:N})).toBe(false)});
it('rescore 60d',()=>{expect(SR({lastScored:A(60)})).toBe(true)});
});

describe('DQ Coverage',()=>{
it('DQ spam',()=>{expect(DQ({...B,flags:['spam']}).disqualified).toBe(true)});
it('DQ bot',()=>{expect(DQ({...B,flags:['bot']}).disqualified).toBe(true)});
it('DQ inactive 365d',()=>{expect(DQ({...B,lastActive:A(365)}).disqualified).toBe(true)});
it('clean passes',()=>{expect(DQ({...B,flags:[]}).disqualified).toBe(false)});
it('returns reason',()=>{expect(DQ({...B,flags:['spam']}).reason).toBeDefined()});
it('multi flags',()=>{expect(DQ({...B,flags:['spam','bot']}).disqualified).toBe(true)});
it('missing flags safe',()=>{const l={...B};delete l.flags;expect(()=>DQ(l)).not.toThrow()});
it('empty lead ok',()=>{expect(DQ({...B,followers:0,flags:[]}).disqualified).toBe(false)});
});
