# Contributing to Ghost Engine

Thank you for your interest in contributing to **Ghost Engine** — the AI-powered monetization engine for creators, powered by Zo.

## Table of Contents

- [Adding New Agents](#adding-new-agents)
- [Adding New Scripts](#adding-new-scripts)
- [Coding Conventions](#coding-conventions)
- [Environment Setup](#environment-setup)
- [Pull Request Process](#pull-request-process)

---

## Adding New Agents

Ghost Engine is built around autonomous agents that each handle a specific function in the monetization pipeline.

1. Create a new file in the `scripts/` directory with a descriptive name (e.g., `scripts/your-agent-name.js`).
2. Follow the existing agent pattern:
   - Load environment variables via `dotenv`
   - Export a main function that can run standalone or be called by the pipeline
   - Include logging so Zo can track agent activity
3. Register your agent in `scripts/pipeline-automation.js` if it should run as part of the main pipeline.
4. Add a corresponding npm script in `package.json` for standalone execution.

## Adding New Scripts

1. Place all executable scripts in the `scripts/` directory.
2. Name files using kebab-case (e.g., `lead-hunter.js`, `kpi-dashboard.js`).
3. Each script should be independently runnable via `node scripts/<name>.js`.
4. Add an entry to the `scripts` section of `package.json`:
   ```json
   "your-command": "node scripts/your-script.js"
   ```

## Coding Conventions

- **Runtime:** Node.js (LTS recommended)
- **Module system:** CommonJS (`require` / `module.exports`)
- **Async patterns:** Use `async/await` over raw Promises or callbacks
- **Environment variables:** Always load via `dotenv` at the top of each script:
  ```js
  require('dotenv').config();
  ```
- **Error handling:** Wrap main logic in try/catch blocks with descriptive error messages
- **Naming:**
  - Files: `kebab-case.js`
  - Variables/functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
- **No unused dependencies:** Only add packages to `package.json` that are actively used

## Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/djbiz/ghost-engine.git
   cd ghost-engine
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in the required API keys and configuration values in `.env`. Never commit `.env` to version control.

4. **Run the pipeline:**
   ```bash
   npm start
   ```

5. **Run individual agents:**
   ```bash
   npm run hunt       # Lead hunting
   npm run outreach   # Outreach engine
   npm run linkedin   # LinkedIn daily engagement
   npm run kpi        # KPI dashboard
   npm run close      # Speed-close trigger
   npm run momentum   # Momentum controller
   npm run proof      # Proof loop
   npm run launch     # Launch countdown
   ```

## Pull Request Process

1. **Fork** the repository and create a feature branch from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding conventions above.

3. **Test locally** — ensure your script runs without errors:
   ```bash
   node scripts/your-script.js
   ```

4. **Commit** with a clear, descriptive message:
   ```bash
   git commit -m "feat: add new agent for [purpose]"
   ```
   Use conventional commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

5. **Push** your branch and open a Pull Request against `master`.

6. **PR Review:** All PRs require at least one review before merging. Describe what your agent does, how it fits into the pipeline, and any new environment variables required.

---

Built with purpose by Derek Jamieson. Powered by Zo.
