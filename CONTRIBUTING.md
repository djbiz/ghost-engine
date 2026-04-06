# Contributing to Ghost Engine

Guidelines for contributing to Ghost Engine.

---

## Adding New Agents

When adding a new agent to the system:

1. Create the agent script in `scripts/` following the naming convention: `automation-<agent-name>.js`
2. Add the agent's schedule to the heartbeat system in `system/HEARTBEAT.md`
3. Document the agent in `system/AGENTS.md` with schedule, inputs/outputs, integration points, SLAs
4. Write integration tests in `tests/integration/<agent-name>.test.js` using Jest conventions
5. Update the CI workflow if the agent introduces new dependencies

---

## Adding New Scripts

When adding a new automation script to `scripts/`:

1. Follow the module pattern -- export key functions for programmatic use
2. Add a corresponding entry in `system/SCRIPTS.md`
3. If the script requires environment variables, document them in `.env.example`
4. Add tests in `tests/integration/` covering core functionality

---

## Coding Conventions

- **Runtime:** Node.js 18+ (LTS)
- **Module System:** CommonJS (`require` / `module.exports`)
- **Testing:** Jest with `describe` / `it` / `expect` pattern
- **File Naming:** Lowercase with hyphens (`lead-scoring.js`, `dm-engine.js`)
- **Environment Variables:** Loaded via `dotenv`; never commit `.env` files

---

## Environment Setup

```bash
git clone https://github.com/djbiz/ghost-engine.git
cd ghost-engine
npm install
cp .env.example .env
npm test
npm start
```

---

## Pull Request Process

1. Branch from `master` (`feature/`, `fix/`, `docs/`)
2. Write or update tests for any changed functionality
3. Run the test suite locally: `npm test`
4. Open a PR targeting `master` with a clear description
5. CI checks must pass (GitHub Actions runs tests on Node.js 18 and 20)
6. Request review and squash-merge once approved

---

## Running Tests

Ghost Engine uses [Jest](https://jestjs.io/) as its test framework. All integration tests live in `tests/integration/`.

### Run All Tests

```bash
npm test
```

### Run Individual Test Suites

```bash
# Lead Scoring tests (56 tests across 6 suites)
npx jest tests/integration/lead-scoring.test.js

# Momentum Controller tests (35 tests across 4 suites)
npx jest tests/integration/momentum-controller.test.js
```

### Run with Verbose Output

```bash
npx jest --verbose
```

---

## Test Suites

### Lead Scoring (`tests/integration/lead-scoring.test.js`)

Validates the weighted lead scoring engine, tier classification, disqualification logic, score decay, platform modifiers, and re-scoring triggers.

| Suite | Tests | Coverage |
|-------|-------|----------|
| Weighted Scoring Factors | 16 | Followers (max 40pts), Niche Match (max 30pts), Email Availability (max 15pts), Profile Completeness (max 15pts), Content Signals (max 30pts), Activity Recency (max 10pts), Score Normalization (140 raw to 0-100 scale) |
| Score Tiers | 8 | Hot (80-100), Warm (60-79), Cold (40-59), Dead (<40) boundary classification |
| Disqualification Criteria | 7 | fake/bot, competitor, blacklisted domain, inactive >6 months, previous opt-out, inappropriate content, duplicate lead |
| Score Decay | 9 | Decay at 7d (-2), 14d (-5), 30d (-10), 60d (-20), 90d (-30); floor at 0; reset on engagement; tier demotion on threshold breach |
| Platform-Specific Modifiers | 9 | LinkedIn bonuses/penalties (+5/+3/-5), TikTok bonuses/penalties (+5/+3/-5), YouTube bonuses/penalties (+5/+3/-5) |
| Re-scoring Triggers | 7 | New engagement, follower change >10%, form/call completion, manual override, weekly batch, platform migration, data correction |

### Momentum Controller (`tests/integration/momentum-controller.test.js`)

Validates momentum state management, multiplier application, auto-adjust logic, and state transitions.

| Suite | Tests | Coverage |
|-------|-------|----------|
| Momentum States | 7 | All 5 states (SURGE, STACK, SPIKE, DRY, NORMAL) + initial state validation + unknown state rejection |
| State Multipliers | 9 | SURGE 2.0x, STACK 1.5x, SPIKE 1.75x, DRY 0.5x, NORMAL 1.0x applied to outreach counts, content frequency, follow-up urgency |
| Auto-Adjust Logic | 7 | Threshold-based transitions: high leads+closes -> SURGE, consistent pipeline -> STACK, viral content -> SPIKE, low activity -> DRY |
| State Transitions | 12 | Valid transitions between all states, edge cases (SURGE->DRY, DRY->SURGE), multiplier updates on transition, history logging with timestamps |

---

## Expected Test Output

### Lead Scoring (Verbose)

```
 PASS  tests/integration/lead-scoring.test.js
  Lead Scoring Engine
    Weighted Scoring Factors
      ✓ should score followers up to 40 points max
      ✓ should score niche match up to 30 points max
      ✓ should score email availability up to 15 points max
      ✓ should score profile completeness up to 15 points max
      ✓ should score content signals up to 30 points max
      ✓ should score activity recency up to 10 points max
      ✓ should calculate max raw score of 140
      ✓ should normalize 140 raw to 100 scaled
      ✓ should normalize 70 raw to 50 scaled
      ✓ should return 0 for zero raw score
      ✓ should handle partial scoring factors
      ✓ should apply follower tier brackets correctly
      ✓ should weight niche relevance keywords
      ✓ should detect verified email addresses
      ✓ should evaluate profile bio completeness
      ✓ should score recent content engagement
    Score Tiers
      ✓ should classify score 80 as Hot
      ✓ should classify score 100 as Hot
      ✓ should classify score 79 as Warm
      ✓ should classify score 60 as Warm
      ✓ should classify score 59 as Cold
      ✓ should classify score 40 as Cold
      ✓ should classify score 39 as Dead
      ✓ should classify score 0 as Dead
    Disqualification Criteria
      ✓ should disqualify fake/bot accounts
      ✓ should disqualify competitor accounts
      ✓ should disqualify blacklisted domains
      ✓ should disqualify accounts inactive >6 months
      ✓ should disqualify previous opt-outs
      ✓ should disqualify inappropriate content
      ✓ should disqualify duplicate leads
    Score Decay
      ✓ should apply -2 decay at 7 days
      ✓ should apply -5 decay at 14 days
      ✓ should apply -10 decay at 30 days
      ✓ should apply -20 decay at 60 days
      ✓ should apply -30 decay at 90 days
      ✓ should floor decayed score at 0
      ✓ should reset decay on new engagement
      ✓ should demote tier on threshold breach
      ✓ should not decay scores less than 7 days old
    Platform-Specific Modifiers
      ✓ should apply LinkedIn +5 for Services/Creator mode
      ✓ should apply LinkedIn +3 for 500+ connections
      ✓ should apply LinkedIn -5 for no profile photo
      ✓ should apply TikTok +5 for verified badge
      ✓ should apply TikTok +3 for link in bio
      ✓ should apply TikTok -5 for no posts in 30 days
      ✓ should apply YouTube +5 for monetization enabled
      ✓ should apply YouTube +3 for consistent uploads
      ✓ should apply YouTube -5 for fewer than 10 videos
    Re-scoring Triggers
      ✓ should re-score on new engagement event
      ✓ should re-score on follower change >10%
      ✓ should re-score on form completion
      ✓ should re-score on call completion
      ✓ should re-score on manual override
      ✓ should re-score in weekly batch
      ✓ should re-score on data correction

Test Suites: 1 passed, 1 total
Tests:       56 passed, 56 total
Time:        2.847 s
```

### Momentum Controller (Verbose)

```
 PASS  tests/integration/momentum-controller.test.js
  Momentum Controller
    Momentum States
      ✓ should initialize in NORMAL state
      ✓ should recognize SURGE state
      ✓ should recognize STACK state
      ✓ should recognize SPIKE state
      ✓ should recognize DRY state
      ✓ should recognize NORMAL state
      ✓ should reject unknown states
    State Multipliers
      ✓ should apply 2.0x multiplier for SURGE
      ✓ should apply 1.5x multiplier for STACK
      ✓ should apply 1.75x multiplier for SPIKE
      ✓ should apply 0.5x multiplier for DRY
      ✓ should apply 1.0x multiplier for NORMAL
      ✓ should apply multiplier to outreach counts
      ✓ should apply multiplier to content frequency
      ✓ should apply multiplier to follow-up urgency
      ✓ should not apply negative multipliers
    Auto-Adjust Logic
      ✓ should transition to SURGE on high leads and closes
      ✓ should transition to STACK on consistent pipeline
      ✓ should transition to SPIKE on viral content detection
      ✓ should transition to DRY on low activity
      ✓ should remain NORMAL when no thresholds met
      ✓ should evaluate multiple metrics simultaneously
      ✓ should use rolling 7-day window for evaluation
    State Transitions
      ✓ should allow NORMAL to SURGE transition
      ✓ should allow NORMAL to STACK transition
      ✓ should allow NORMAL to SPIKE transition
      ✓ should allow NORMAL to DRY transition
      ✓ should allow SURGE to DRY transition
      ✓ should allow DRY to SURGE transition
      ✓ should update multiplier on state change
      ✓ should log transition with timestamp
      ✓ should maintain transition history
      ✓ should handle rapid state changes
      ✓ should validate state before transition
      ✓ should emit event on state transition

Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
Time:        1.923 s
```

### Combined Summary

```
Test Suites: 2 passed, 2 total
Tests:       91 passed, 91 total
Snapshots:   0 total
Time:        4.770 s
```

---

## Continuous Integration

Tests run automatically via GitHub Actions on every pull request to `master`.

- **Workflow:** `.github/workflows/ci.yml`
- **Trigger:** Pull requests targeting `master`
- **Node.js Matrix:** 18, 20
- **Commands:** `npm ci` followed by `npm test` with `CI=true`

See the [Actions tab](https://github.com/djbiz/ghost-engine/actions) for recent runs.
