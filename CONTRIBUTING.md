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
# Lead Scoring tests (55 tests across 6 suites)
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
| Weighted Scoring Factors | 16 | Followers (max 40pts), Niche Match (max 30pts), Email Availability (max 15pts), Profile Completeness (max 15pts), Content Signals (max 30pts), Activity Recency (max 10pts), Score Normalization |
| Score Tiers | 8 | Hot (80-100), Warm (60-79), Cold (40-59), Dead (<40) boundary tests |
| Disqualification Criteria | 7 | fake/bot, competitor, blacklisted domain, inactive >6mo, opt-out, inappropriate content, duplicate |
| Score Decay | 10 | Decay at 7/14/30/60/90 day intervals, floor at 0, reset on engagement, tier demotion |
| Platform-Specific Modifiers | 9 | LinkedIn (+5/+3/-5), TikTok (+5/+3/-5), YouTube (+5/+3/-5) |
| Re-scoring Triggers | 5 | New engagement, follower change >10%, form/call completion, manual override, weekly batch |
| **Total** | **55** | |

### Momentum Controller (`tests/integration/momentum-controller.test.js`)

Validates the 5-state momentum machine, state multipliers, auto-adjust logic, and state transitions.

| Suite | Tests | Coverage |
|-------|-------|----------|
| Momentum States | 10 | All 5 states (SURGE, STACK, SPIKE, DRY, NORMAL), initial state validation |
| State Multipliers | 8 | SURGE 2.0x, STACK 1.5x, SPIKE 1.75x, DRY 0.5x, NORMAL 1.0x |
| Auto-Adjust Logic | 7 | Threshold-based transitions, activity monitoring, cooldown periods |
| State Transitions | 10 | Valid transitions, edge cases, multiplier updates, history logging |
| **Total** | **35** | |


---

## Expected Test Output

When all tests pass, `npx jest --verbose` produces output similar to:

```
 PASS  tests/integration/lead-scoring.test.js
  Weighted Scoring Factors
    Followers factor (max 40pts)
      ✓ should award 40 points for 100k+ followers (1 ms)
      ✓ should award proportional points for moderate follower counts
      ✓ should award 0 points for 0 followers
    Niche match factor (max 30pts)
      ✓ should award 30 points for exact niche match
      ...
  Score Tiers
    ✓ should classify score 80 as Hot
    ...
  Disqualification Criteria
    ✓ should disqualify and zero-score for fake/bot account
    ...
  Score Decay
    ✓ should apply -2 point decay after 7 days of no engagement
    ...
  Platform-Specific Modifiers
    LinkedIn
      ✓ should add +5 for Services/Creator Mode enabled
    TikTok
      ✓ should add +5 for verified TikTok account
    YouTube
      ✓ should add +5 for monetization enabled
    ...
  Re-scoring Triggers
    ✓ should trigger re-score on new engagement data
    ...

Test Suites: 1 passed, 1 total
Tests:       56 passed, 56 total
Time:        1.284 s

 PASS  tests/integration/momentum-controller.test.js
  MomentumController
    Momentum States
      ✓ should define exactly five momentum states
      ✓ should include SURGE as a valid state
      ...
    State Multipliers
      ✓ should assign a 2.0x multiplier to SURGE
      ...
    Auto-Adjust Logic
      ✓ should transition to SURGE when leads and closes are both high
      ...
    State Transitions
      ✓ should allow transition from NORMAL to SURGE
      ✓ should log each transition in the transition history
      ...

Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
Time:        0.847 s
```

### Combined Summary

```
Test Suites: 2 passed, 2 total
Tests:       91 passed, 91 total
Snapshots:   0 total
Time:        2.131 s
Ran all test suites.
```

---

## Continuous Integration

Tests run automatically on every pull request targeting `master` via GitHub Actions.

**Workflow:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

| Setting | Value |
|---------|-------|
| **Trigger** | Pull requests to `master` |
| **Runner** | `ubuntu-latest` |
| **Node.js** | 18, 20 (matrix strategy) |
| **Install** | `npm ci` |
| **Test Command** | `npm test` with `CI=true` |

CI status appears on each PR as a check — green checkmark means all tests passed on both Node versions.

---

*Last updated: 2025-04-06*
