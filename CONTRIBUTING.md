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
# Lead Scoring tests (55 tests)
npx jest tests/integration/lead-scoring.test.js

# Momentum Controller tests (35 tests)
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
| Score Decay | 10 | Decay at 7d/14d/30d/60d/90d intervals, floor at 0, reset on engagement, tier demotion |
| Platform-Specific Modifiers | 9 | LinkedIn (+5/+3/-5), TikTok (+5/+3/-5), YouTube (+5/+3/-5) |
| Re-scoring Triggers | 5 | Engagement event, follower change >10%, form/call completion, manual override, weekly batch |
| **Total** | **55** | |

### Momentum Controller (`tests/integration/momentum-controller.test.js`)

Validates momentum state detection, multiplier application, auto-adjust logic, and state transitions.

| Suite | Tests | Coverage |
|-------|-------|----------|
| Momentum States | 8 | SURGE, STACK, SPIKE, DRY, NORMAL identification + initial state validation |
| State Multipliers | 10 | SURGE 2.0x, STACK 1.5x, SPIKE 1.75x, DRY 0.5x, NORMAL 1.0x applied to outreach counts, content frequency, follow-up urgency |
| Auto-Adjust Logic | 9 | Threshold-based transitions: high leads+closes -> SURGE, consistent pipeline -> STACK, viral content -> SPIKE, low activity -> DRY |
| State Transitions | 8 | Valid transitions between all states, edge cases (SURGE->DRY, DRY->SURGE), multiplier updates on transition, history logging |
| **Total** | **35** | |

---

## Combined Test Summary

| Test File | Tests |
|-----------|-------|
| lead-scoring.test.js | 55 |
| momentum-controller.test.js | 35 |
| **Total** | **90** |
