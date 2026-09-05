# Autonomous UI Test

An agent-driven QA pipeline that turns a GitHub issue (labeled **RFQA** /
**Ready for QA**) into executed, evidenced Playwright tests — without a human
writing test code by hand. Three Claude Code subagents run in sequence, each
producing a plain file the next stage consumes:

```
GitHub Issue (label: RFQA / "Ready for QA")
        │  gitReaderAgent
        ▼
   plan.md                 (Acceptance Criteria, verbatim)
        │  testPlannerAgent
        ▼
   SCENARIOS.md             (concrete test scenarios)
        │  testGeneratorAgent
        ▼
   tests/pages/*.ts + tests/specs/*.spec.ts   (Playwright Page Objects + specs)
        │  npm test
        ▼
   test-results/, evidence/                    (pass/fail + evidence)
   playwright-report/, allure-results/, allure-report/   (HTML reports, auto-built)
```

For the deep-dive on how each stage works internally, the GitHub MCP
integration, and the cross-repo automatic-trigger design, see
[PIPELINE.md](PIPELINE.md). This README focuses on **setting the project up
from scratch** and **what every file does**.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm
- A GitHub **personal access token** with `repo` scope (used to read issues
  via the hosted GitHub MCP server)
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) if you want
  to run the subagents locally (`npm install -g @anthropic-ai/claude-code`),
  or Claude Code as this IDE extension
- A running/reachable instance of the app under test (defaults to the public
  demo site [saucedemo.com](https://www.saucedemo.com), no setup needed)

## Setup from scratch

1. **Clone and install dependencies**
   ```bash
   git clone <this-repo-url>
   cd Autonomous_UI_Test
   npm install
   ```

2. **Install the Playwright browser binaries** (only Chromium is configured):
   ```bash
   npx playwright install --with-deps chromium
   ```

3. **Create your `.env` file** from the template and fill in the values:
   ```bash
   cp .env.example .env
   ```
   Required:
   - `GITHUB_TOKEN` — PAT with `repo` scope, used to authenticate to the
     hosted GitHub MCP server (`https://api.githubcopilot.com/mcp/`).

   Optional (defaults shown are already sensible for the sample app):
   - `GITHUB_MCP_URL` — override the MCP endpoint.
   - `GITHUB_OWNER` / `GITHUB_REPO` — default owner/repo to read issues from
     (defaults to `Bhushanbn/GitRepo_Acceptance-Criteria`).
   - `GITHUB_RFQA_STATUS` — the label text that marks an issue ready for QA
     (default `Ready for QA`).
   - `GITHUB_PROJECT_NUMBER` — reserved for a future Projects-v2-aware MCP
     server; unused today.
   - `GITHUB_WEBHOOK_SECRET` / `WEBHOOK_PORT` — reserved for a future
     real-time webhook trigger; unused today.
   - `APP_BASE_URL` — the app under test's base URL (default
     `https://www.saucedemo.com`).

4. **(Optional) Set up the automatic GitHub → CI trigger.** The pipeline can
   also run in GitHub Actions ([.github/workflows/rfqa-pipeline.yml](.github/workflows/rfqa-pipeline.yml)),
   triggered manually or via a `repository_dispatch` from a second workflow
   living in the acceptance-criteria repo. See "Automatic trigger" in
   [PIPELINE.md](PIPELINE.md) for the exact companion workflow and secrets
   needed. This step is optional — the manual sequence below always works.

5. **Run the pipeline manually** (from Claude Code, in this repo):
   ```
   1. Use gitReaderAgent to read GitHub issue #<n> and write its acceptance criteria into plan.md
   2. Use testPlannerAgent to generate test scenarios from plan.md into SCENARIOS.md
   3. Use testGeneratorAgent to generate and run tests from SCENARIOS.md
   ```
   Or, once `tests/specs/*.spec.ts` files exist, run them directly:
   ```bash
   npm test
   ```
   `npm test` runs `node scripts/run-tests.mjs`, which runs Playwright and
   then **always** regenerates the Allure HTML report afterward — even if
   tests fail — so both reports are ready after every run without an extra
   step.

6. **View reports.**
   ```bash
   npm run report:html    # opens Playwright's built-in HTML report
   npm run report:open    # opens the generated Allure report
   npm run report:generate  # (re)generates allure-report/ from allure-results/ on demand
   ```

## Project structure — every file explained

### Root

| File | Purpose |
|---|---|
| [package.json](package.json) | Project manifest. ESM (`"type": "module"`). Dependencies: `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk` (GitHub MCP client), `@playwright/test`, `dotenv`. Dev dependencies: `@playwright/mcp`, `allure-playwright`/`allure-commandline` (reporting), `tsx` (run TS files directly), `typescript`. Scripts: `test` (runs Playwright then always builds the Allure report, see `scripts/run-tests.mjs`), `report:generate`, `report:open` (Allure), `report:html` (Playwright's built-in report). |
| [package-lock.json](package-lock.json) | npm's locked dependency tree — do not edit by hand. |
| [tsconfig.json](tsconfig.json) | TypeScript compiler config: ESNext/NodeNext modules, strict mode on, no build output configured (files are run via `tsx`, not compiled to `dist/`). |
| [playwright.config.ts](playwright.config.ts) | Playwright test runner config: tests live in `tests/specs`, Chromium only, trace/screenshot/video captured on failure, `baseURL` read from `APP_BASE_URL` env var. Three reporters: `list`, the built-in `html` reporter (→ `playwright-report/`), and `allure-playwright` (→ `allure-results/`). |
| [scripts/run-tests.mjs](scripts/run-tests.mjs) | Runner invoked by `npm test`. Runs `playwright test`, then **always** runs `allure generate allure-results --clean -o allure-report` afterward regardless of test outcome, then exits with Playwright's original exit code (so CI still sees failures). |
| [.env](.env) | Your local secrets/config (git-ignored). Not committed — created by you from `.env.example`. |
| [.env.example](.env.example) | Template documenting every environment variable the project reads (see Setup step 3 above). |
| [.gitignore](.gitignore) | Excludes `node_modules/`, `.env`, Playwright/Allure output directories' contents, etc. |
| [plan.md](plan.md) | **Generated output** of Stage 1 (`gitReaderAgent`) — the current GitHub issue's Acceptance Criteria, overwritten on each run. Committed here as a working example. |
| [SCENARIOS.md](SCENARIOS.md) | **Generated output** of Stage 2 (`testPlannerAgent`) — concrete test scenarios derived from `plan.md`, overwritten on each run. Committed here as a working example. |
| [PIPELINE.md](PIPELINE.md) | Detailed architecture doc: how each agent stage works, the GitHub MCP integration and its limitations, and the cross-repo automatic-trigger design. |
| [README.md](README.md) | This file. |

### `.claude/agents/` — the three pipeline subagents

Each `.md` file is a Claude Code subagent definition (frontmatter + system
prompt) invoked by name from a Claude Code session.

| File | Role |
|---|---|
| [gitReaderAgent.md](.claude/agents/gitReaderAgent.md) | Stage 1. Reads a GitHub issue via `src/mcp/githubClient.ts` and writes its Acceptance Criteria verbatim into `plan.md`. Tools: Read, Write, Bash, Grep, Glob (no direct network access — shells out via `npx tsx`). |
| [testPlannerAgent.md](.claude/agents/testPlannerAgent.md) | Stage 2. Reads `plan.md`'s Acceptance Criteria and expands each into one or more concrete scenarios (`ACn-Sm` IDs) written to `SCENARIOS.md`. Pure text transformation — no Bash/network tools. Refuses to run if `plan.md` has no Acceptance Criteria section yet. |
| [testGeneratorAgent.md](.claude/agents/testGeneratorAgent.md) | Stage 3. Reads `SCENARIOS.md`, generates Playwright Page Objects (`tests/pages/`) and spec files (`tests/specs/`), runs them, and iterates on failures within a bounded retry budget before reporting a blocker. Refuses to run if `SCENARIOS.md` is missing. |

### `src/` — supporting TypeScript code

| File | Purpose |
|---|---|
| [src/config.ts](src/config.ts) | Central, env-driven config object read by everything else. Throws immediately if `GITHUB_TOKEN` is missing. Exposes `config.github.*` and `config.app.baseUrl`. |
| [src/types.ts](src/types.ts) | Shared TypeScript types — currently just `RfqaIssue` (owner/repo/number/title/url/body/status), the shape `gitReaderAgent` writes into `plan.md`. |
| [src/mcp/githubClient.ts](src/mcp/githubClient.ts) | Hand-rolled MCP client connecting over Streamable HTTP to GitHub's hosted MCP server. Exposes `getIssue(owner, repo, number)`, `listRfqaIssues(owner, repo)` (filters open issues by an RFQA/"Ready for QA" label), and `parseIssueUrlParam()` (decodes a Projects-board URL's `issue=Owner\|Repo\|Number` param). Called via `npx tsx` from `gitReaderAgent`. |
| [src/mcp/playwrightMcpClient.ts](src/mcp/playwrightMcpClient.ts) | **Empty stub.** Reserved for an optional Playwright MCP client integration for Stage 3; not currently used — `testGeneratorAgent` falls back to plain `@playwright/test`. |
| [src/reporting/evidenceLogger.ts](src/reporting/evidenceLogger.ts) | **Empty stub.** Reserved for attaching extra evidence (screenshots/traces) to `evidence/` beyond what `@playwright/test` already captures; not currently used. |
| [src/reporting/reportBuilder.ts](src/reporting/reportBuilder.ts) | **Empty stub.** Reserved for programmatically driving Allure report generation instead of the manual `npx allure generate` command; not currently used. |

### `tests/` — generated Playwright test suite

Everything here is generated (and re-generated) by `testGeneratorAgent`, but
is committed as a working example against saucedemo.com.

| File | Purpose |
|---|---|
| [tests/pages/LoginPage.ts](tests/pages/LoginPage.ts) | Page Object for the login screen — locators (username/password/login button/error message) and actions (`goto`, `login`, error-state checks), using Playwright's accessible/`getByTestId` locators rather than CSS/XPath. |
| [tests/pages/ProductsPage.ts](tests/pages/ProductsPage.ts) | Page Object for the products/inventory listing page (e.g. add-to-cart actions, cart badge). |
| [tests/pages/CartPage.ts](tests/pages/CartPage.ts) | Page Object for the cart page. |
| [tests/pages/CheckoutPage.ts](tests/pages/CheckoutPage.ts) | Page Object for the checkout form + overview + confirmation steps. |
| [tests/specs/login.spec.ts](tests/specs/login.spec.ts) | Spec file covering AC1/AC2 scenarios from `SCENARIOS.md` (valid login, invalid login, empty credentials). |
| [tests/specs/cart.spec.ts](tests/specs/cart.spec.ts) | Spec file covering AC3 (add product to cart). |
| [tests/specs/checkout.spec.ts](tests/specs/checkout.spec.ts) | Spec file covering AC4 (end-to-end checkout + confirmation). |

### `.github/workflows/`

| File | Purpose |
|---|---|
| [rfqa-pipeline.yml](.github/workflows/rfqa-pipeline.yml) | GitHub Actions workflow that runs the full pipeline in CI. Triggers on manual `workflow_dispatch` (with `owner`/`repo`/`issue_number` inputs) or on a `repository_dispatch` event of type `rfqa-ready` sent from a companion workflow in the acceptance-criteria repo. Installs dependencies, Playwright, and the Claude Code CLI, then runs one `claude -p` prompt driving all three agents end-to-end, runs the tests, posts a PASS/FAIL comment on the source issue, and uploads the Playwright/Allure/generated-file artifacts. |

### Output/artifact directories (git-ignored contents, kept via `.gitkeep`)

| Directory | Purpose |
|---|---|
| `test-results/` | Raw Playwright test-run output (traces, screenshots, videos on failure). `.last-run.json` tracks the most recent run for `--last-failed` reruns. |
| `playwright-report/` | Playwright's own static HTML report, regenerated on every `npm test` run. Open with `npm run report:html`. |
| `allure-results/` | Raw Allure result files written by the `allure-playwright` reporter; input to `allure generate`. |
| `allure-report/` | Generated static Allure HTML report, rebuilt after every `npm test` run by `scripts/run-tests.mjs` (or on demand via `npm run report:generate`). Open with `npm run report:open`. |
| `evidence/` | Reserved output location for the (currently stubbed) `evidenceLogger.ts` to attach extra QA evidence. |

## Environment variables reference

See [.env.example](.env.example) for the authoritative list with inline
comments; summarized:

| Variable | Required | Default | Used by |
|---|---|---|---|
| `GITHUB_TOKEN` | Yes | — | `src/config.ts` / `src/mcp/githubClient.ts` |
| `GITHUB_MCP_URL` | No | `https://api.githubcopilot.com/mcp/` | `src/mcp/githubClient.ts` |
| `GITHUB_OWNER` | No | `Bhushanbn` | `gitReaderAgent` default target |
| `GITHUB_REPO` | No | `GitRepo_Acceptance-Criteria` | `gitReaderAgent` default target |
| `GITHUB_RFQA_STATUS` | No | `Ready for QA` | label match in `listRfqaIssues` |
| `GITHUB_PROJECT_NUMBER` | No | `2` | reserved, unused |
| `GITHUB_WEBHOOK_SECRET` / `WEBHOOK_PORT` | No | — | reserved, unused |
| `APP_BASE_URL` | No | `https://www.saucedemo.com` | `playwright.config.ts` |

## Known limitations

- The hosted GitHub MCP server has no Projects (v2) toolset, so
  `gitReaderAgent` can only detect "ready for QA" via an issue **label**, not
  a Projects-board Status-column move. See [PIPELINE.md](PIPELINE.md) for
  details and the workaround.
- `src/mcp/playwrightMcpClient.ts`, `src/reporting/evidenceLogger.ts`, and
  `src/reporting/reportBuilder.ts` are empty stubs — reserved extension
  points, not wired into the pipeline yet.
