# Contributing to Ghost Engine

Guidelines for contributing to Ghost Engine — the AI-powered monetization engine for creators and operators.

---

## Adding New Agents

When adding a new agent to the system:

1. Create the agent script in `scripts/` following the naming convention: `automation-<agent-name>.js`
2. Add the agent's schedule to the heartbeat system in `system/HEARTBEAT.md`
3. Document the agent in `system/AGENTS.md` with:
   - Schedule and trigger conditions
   - Input sources and output targets
   - Integration points with other agents
   - SLA and escalation rules
4. Write integration tests in `tests/integration/<agent-name>.test.js` using Jest conventions:
   ```javascript
   describe('AgentName', () => {
     describe('Feature Group', () => {
       it('should do something specific', () => {
         // test implementation
       });
     });
   });
   ```
5. Update the CI workflow if the agent introduces new dependencies

---

## Adding New Scripts

When adding a new automation script to `scripts/`:

1. Follow the module pattern — export key functions for programmatic use:
   ```javascript
   'use strict';

   function myFunction(params) {
     // implementation
   }

   module.exports = { myFunction };
   ```
2. Add a corresponding entry in `system/SCRIPTS.md` with:
   - Purpose and category
   - Key functions and exports
   - Dependencies (external APIs, env vars)
   - Integration points with other scripts
3. If the script requires environment variables, document them in `.env.example`
4. Add tests in `tests/integration/` covering core functionality

---

## Coding Conventions

- **Runtime:** Node.js 18+ (LTS)
- **Module System:** CommonJS (`require` / `module.exports`)
- **Testing:** Jest with `describe` / `it` / `expect` pattern
- **Linting:** ESLint with project configuration
- **File Naming:** Lowercase with hyphens (`lead-scoring.js`, `dm-engine.js`)
- **Environment Variables:** Loaded via `dotenv`; never commit `.env` files
- **Data Storage:** CSV files in `data/` directory for pipeline state; JSON for configuration
- **Error Handling:** Always log errors with context; use structured logging via `logger.js`

---

## Environment Setup

```bash
# 1. Clone the repo
git clone https://github.com/djbiz/ghost-engine.git
cd ghost-engine

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your API keys and config

# 4. Run tests to verify setup
npm test

# 5. Start the engine
npm start
```

---

## Pull Request Process

1. **Branch from master** using the naming convention:
   - `feature/<description>` for new features
   - `fix/<description>` for bug fixes
   - `docs/<description>` for documentation updates
2. **Write or update tests** for any changed functionality
3. **Run the test suite locally** before pushing:
   ```bash
   npm test
   ```
4. **Open a PR targeting `master`** with a clear description of changes
5. **CI checks must pass** — GitHub Actions runs tests on Node.js 18 and 20
6. **Request review** from a team member
7. **Squash and merge** once approved

---

## Running Tests

Ghost Engine uses [Jest](https://jestjs.io/) as its test framework. All integration tests live in `tests/integration/`.

### Run All Tests

```bash
npm test
```

### Run Individual Test Suites

```bash
# Lead Scoring tests
npx jest tests/integration/lead-scoring.test.js

# Momentum Controller tests
npx jest tests/integration/momentum-controller.test.js
```

### Test Execution Results

When tests pass, you should see output similar to:

```
PASS  tests/integration/lead-scoring.test.js
  LeadScoring
    Weighted Scoring Factors
      ✓ should assign up to 40 points for follower count
      ✓ should assign up to 30 points for niche match
      ✓ should assign up to 15 points for email availability
      ✓ should assign up to 15 points for profile completeness
      ✓ should assign up to 30 points for content signals
      ✓ should assign up to 10 points for activity recency
      ✓ should cap raw score at 140 and normalize to 0-100
    Score Tiers
      ✓ should classify 80-100 as Hot
      ✓ should classify 60-79 as Warm
      ✓ should classify 40-59 as Cold
      ✓ should classify below 40 as Dead
    Disqualification Criteria
      ✓ should force score=0 and tier=Dead for disqualified leads
    Score Decay
      ✓ should apply -2 after 7 days of inactivity
      ✓ should apply -5 after 14 days
      ✓ should apply -10 after 30 days
      ✓ should clamp score at minimum 0
    Platform-Specific Adjustments
      ✓ should apply LinkedIn bonuses and penalties
      ✓ should apply TikTok bonuses and penalties
      ✓ should apply YouTube bonuses and penalties
    Re-scoring Triggers
      ✓ should trigger re-score on new engagement
      ✓ should trigger re-score on follower change >10%

PASS  tests/integration/momentum-controller.test.js
  MomentumController
    Momentum States
      ✓ should initialize in NORMAL state
      ✓ should recognize all 5 states: SURGE, STACK, SPIKE, DRY, NORMAL
    State Multipliers
      ✓ should apply 2.0x multiplier for SURGE
      ✓ should apply 1.5x multiplier for STACK
      ✓ should apply 1.75x multiplier for SPIKE
      ✓ should apply 0.5x multiplier for DRY
      ✓ should apply 1.0x multiplier for NORMAL
    Auto-Adjust Logic
      ✓ should transition to SURGE on high leads and closes
      ✓ should transition to STACK on consistent pipeline
      ✓ should transition to SPIKE on viral content
      ✓ should transition to DRY on low activity
    State Transitions
      ✓ should handle SURGE to DRY transition
      ✓ should handle DRY to SURGE transition
      ✓ should log transition history with timestamps

Test Suites: 2 passed, 2 total
Tests:       35 passed, 35 total
Snapshots:   0 total
Time:        1.842 s
```

---

## Continuous Integration

Ghost Engine uses GitHub Actions for CI. The workflow is defined in `.github/workflows/ci.yml`.

### What CI Does

Every pull request targeting `master` automatically:

1. Checks out the repository
2. Sets up Node.js (matrix: v18 and v20) with npm caching
3. Installs dependencies via `npm ci`
4. Runs the full test suite via `npm test` with `CI=true`

Both Node.js versions run in parallel on `ubuntu-latest` for fast feedback.

### CI Status

CI checks must pass before a PR can be merged. If tests fail:

1. Check the Actions tab on your PR for detailed logs
2. Run the failing tests locally: `npx jest tests/integration/<test-file>`
3. Fix the issue and push — CI will re-run automatically

---

## Questions?

Open an issue or reach out to the team. We're building Ghost Engine together.
