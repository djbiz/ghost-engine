# Contributing to Ghost Engine

Thank you for your interest in contributing to Ghost Engine. This guide covers test coverage, development workflows, and conventions to help you get started.

---

## Test Coverage

All integration tests pass. The project maintains **146 total integration tests** spanning two core modules:

- **Lead Scoring** — 90 tests (`tests/integration/lead-scoring.test.js`)
- **Momentum Controller** — 56 tests (`tests/integration/momentum-controller.test.js`)

Every pull request must pass the full suite before merge.

---

## Test Suites

### Lead Scoring (`tests/integration/lead-scoring.test.js`)

90 tests across 14 suites covering weighted scoring, tier classification, disqualification, decay, platform modifiers, re-scoring triggers, and edge cases.

| # | Suite | Tests | Description |
|---|-------|------:|-------------|
| 1 | Weighted Scoring Factors | 16 | Validates individual scoring weights for follower count, engagement rate, post frequency, bio quality, and other profile signals. |
| 2 | Score Tiers | 8 | Ensures leads are classified into the correct tier (cold, warm, hot, ultra) based on computed score ranges. |
| 3 | Disqualification Criteria | 7 | Verifies that leads meeting disqualification thresholds (spam indicators, bot patterns, blacklisted domains) are correctly flagged. |
| 4 | Score Decay | 9 | Tests time-based score degradation logic, including decay rates, minimum floor values, and decay suspension rules. |
| 5 | Platform-Specific Modifiers | 9 | Confirms platform-aware scoring adjustments for Twitter, LinkedIn, Instagram, TikTok, and other supported platforms. |
| 6 | Re-scoring Triggers | 7 | Validates that profile updates, engagement spikes, and manual overrides correctly trigger a lead re-score. |
| 7 | Follower Boundary Edge Cases | 7 | Tests boundary conditions around follower count thresholds (zero followers, exactly-on-boundary values, extremely large counts). |
| 8 | Profile Element Scoring | 6 | Covers scoring of individual profile elements such as avatar presence, bio length, link validity, and verification status. |
| 9 | Content Signal Granularity | 3 | Validates fine-grained content signal extraction including hashtag relevance, mention patterns, and post sentiment. |
| 10 | Activity Recency Boundaries | 6 | Tests edge cases around activity timestamps — stale profiles, just-expired windows, and exactly-on-boundary recency. |
| 11 | Score Clamping | 3 | Ensures computed scores are clamped within valid bounds (0–100) regardless of extreme input combinations. |
| 12 | DQ Edge Cases | 3 | Covers disqualification edge cases such as partial matches, simultaneous DQ triggers, and DQ reversal scenarios. |
| 13 | Decay Edge Cases | 4 | Tests decay behavior under edge conditions including zero elapsed time, maximum decay, and negative time deltas. |
| 14 | Batch Re-score | 2 | Validates batch re-scoring operations for correctness, ordering, and idempotency across multiple leads. |
| | **Total** | **90** | |

### Momentum Controller (`tests/integration/momentum-controller.test.js`)

56 tests across 10 suites covering momentum state management, multipliers, auto-adjust logic, transitions, and edge cases.

| # | Suite | Tests | Description |
|---|-------|------:|-------------|
| 1 | Momentum States | 7 | Validates all supported momentum states (idle, building, peaked, cooling, stalled, surging, declining) and their properties. |
| 2 | State Multipliers | 9 | Tests that each momentum state applies the correct output multiplier to downstream scoring and action thresholds. |
| 3 | Auto-Adjust Logic | 7 | Verifies the controller's automatic adjustment of momentum based on engagement velocity, trend signals, and configured sensitivity. |
| 4 | State Transitions | 12 | Covers valid and invalid state transitions, ensuring the state machine enforces allowed transition paths and rejects illegal jumps. |
| 5 | Rapid State Cycling | 3 | Tests system stability when momentum states change in rapid succession, guarding against oscillation and race conditions. |
| 6 | Boundary Thresholds | 4 | Validates behavior at exact threshold boundaries between momentum states, including off-by-one and floating-point precision. |
| 7 | Zero-Value Multipliers | 3 | Ensures correct handling when multipliers resolve to zero, preventing division errors and silent data loss downstream. |
| 8 | Invalid State Handling | 3 | Tests graceful handling of unrecognized or corrupted state values, including null, undefined, and malformed strings. |
| 9 | getActiveMultiplier Consistency | 4 | Verifies that `getActiveMultiplier()` returns consistent results across repeated calls, state snapshots, and concurrent access. |
| 10 | History Management | 4 | Covers momentum history recording, retrieval, truncation, and cleanup of stale history entries. |
| | **Total** | **56** | |

---

## Running Tests

Run the full test suite:

```bash
npm test
```

Run a specific test file:

```bash
npx jest tests/integration/lead-scoring.test.js
npx jest tests/integration/momentum-controller.test.js
```

Run with verbose output:

```bash
npx jest --verbose
```

Run a single suite by name:

```bash
npx jest --verbose -t "Score Decay"
```

---

## CI/CD

Continuous integration runs on **GitHub Actions** with the following matrix:

- **Node.js 18** and **Node.js 20**
- Triggered on every push and pull request to `master`

Workflow configuration: `.github/workflows/ci.yml`

All 146 tests must pass on both Node versions before a PR can be merged.

---

## Adding New Agents

1. Create a new file in `src/agents/` following the naming convention `<agent-name>.agent.js`.
2. Export an object conforming to the agent interface (`init`, `execute`, `teardown`).
3. Register the agent in `src/agents/index.js`.
4. Add integration tests in `tests/integration/<agent-name>.test.js`.
5. Document the agent's purpose and configuration in the file header.

---

## Adding New Scripts

1. Create a new file in `scripts/` with a descriptive name (e.g., `seed-leads.js`).
2. Add a corresponding entry in the `scripts` section of `package.json` if it should be callable via `npm run`.
3. Include a usage comment block at the top of the file.
4. Ensure the script exits with a non-zero code on failure for CI compatibility.

---

## Coding Conventions

- **Runtime**: Node.js 18+ (LTS)
- **Module system**: CommonJS (`require` / `module.exports`)
- **Testing framework**: Jest
- | Style**: Follow existing code patterns; no trailing semicolons are acceptable if the file already omits them, otherwise include them.
- **Naming**: camelCase for variables and functions, PascalCase for classes, kebab-case for filenames.
- **Error handling**: Always propagate errors with meaningful messages; never silently swallow exceptions.
- **Dependencies**: Minimize external dependencies. Discuss new packages in the PR description.

---

## Environment Setup

```bash
# Clone the repository
git clone https://github.com/djbiz/ghost-engine.git
cd ghost-engine

# Install dependencies
npm install

# Run all tests to verify setup
npm test
```

Ensure you are running Node.js 18 or later:

```bash
node --version
# Expected: v18.x.x or v20.x.x
```

---

## Pull Request Process

1. **Branch naming**: Use the format `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>`.
2. **Write tests**: Every new feature or bug fix must include corresponding test coverage.
3. **Run the full suite locally**: Execute `npm test` and confirm all 146 tests pass before pushing.
4. **Open a PR against `master`**: Provide a clear title and description of changes.
5. **CI must pass**: GitHub Actions will run the test matrix on Node 18 and 20. All checks must be green.
6. **Code review**: At least one approving review is required before merge.
7. **Squash and merge**: Keep the commit history clean with a single descriptive commit per PR.
