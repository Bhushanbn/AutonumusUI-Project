# Autonomous UI Test

An agent-driven QA pipeline: a GitHub issue labeled "Ready for QA" is turned
into Acceptance Criteria → test scenarios → generated Playwright tests →
executed results, with each stage handled by a dedicated Claude Code
subagent. See [PIPELINE.md](PIPELINE.md) for the full architecture and
current automation gaps; this file covers setup and a file-by-file reference.

## Setup

### Prerequisites
- Node.js 20+
- A GitHub personal access token with `repo` (and, ideally, project) read scope
- [Claude Code](https://claude.com/claude-code) installed, for running the agents interactively or via `claude -p` in CI

### Install
```bash
npm install
npx playwright install --with-deps chromium
```

### Configure environment
Copy the example env file and fill in real values:
```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | yes | Bearer token for GitHub's hosted MCP server (`issue_read`, `list_issues`) |
| `GITHUB_MCP_URL` | no | Override the MCP endpoint (defaults to `https://api.githubcopilot.com/mcp/`) |
| `GITHUB_OWNER` / `GITHUB_REPO` | no | Default repo to pull acceptance-criteria issues from |
| `GITHUB_RFQA_STATUS` | no | Label text that marks an issue ready for QA (default `Ready for QA`) |
| `GITHUB_PROJECT_NUMBER` | no | Kept for reference; not currently used — the hosted MCP server has no Projects v2 toolset |
| `GITHUB_WEBHOOK_SECRET` / `WEBHOOK_PORT` | no | Reserved for a planned real-time webhook trigger (`projects_v2_item` events) — **no receiver is implemented yet**, see PIPELINE.md |
| `APP_BASE_URL` | no | The app under test; also read by `playwright.config.ts` |

`src/config.ts` throws immediately if `GITHUB_TOKEN` is missing, so any
agent step that talks to GitHub will fail fast with a clear error if `.env`
isn't set up.

### Running the pipeline
Manually, inside a Claude Code session:
```
1. "Use gitReaderAgent to read GitHub issue #<n> and write its acceptance criteria into plan.md"
2. "Use testPlannerAgent to generate test scenarios from plan.md into SCENARIOS.md"
3. "Use testGeneratorAgent to generate and run tests from SCENARIOS.md"
```
Or headlessly via the checked-in GitHub Actions workflow — see
[.github/workflows/rfqa-pipeline.yml](.github/workflows/rfqa-pipeline.yml),
triggered manually (`workflow_dispatch`) with `owner`, `repo`, and
`issue_number` inputs.

Once specs exist, you can also just run Playwright directly:
```bash
npx playwright test
npx allure generate ./allure-results --clean -o ./allure-report
npx allure open ./allure-report
```

## File-by-file reference

### Root
| File | Necessity | Function |
|---|---|---|
| `package.json` | required | Dependencies (`@playwright/test`, `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`, `allure-playwright`, `dotenv`, TypeScript tooling) |
| `package-lock.json` | required | Locked dependency versions |
| `tsconfig.json` | required | TypeScript compiler options for `src/` (strict mode, ESNext/NodeNext modules) |
| `playwright.config.ts` | required | Playwright Test config: spec dir `tests/specs`, chromium project, `baseURL` from `APP_BASE_URL`, trace/screenshot/video on failure, `allure-playwright` reporter |
| `.env` | required (gitignored) | Actual secrets/config values, loaded by `dotenv` via `src/config.ts` |
| `.env.example` | reference | Documents every env var the project reads, with defaults/comments |
| `.gitignore` | required | Excludes `node_modules/`, `.env`, `dist/`, `evidence/*`, `allure-results/`, `allure-report/` from version control |
| `plan.md` | generated | Stage 1 output — Acceptance Criteria extracted from the GitHub issue (overwritten each run) |
| `SCENARIOS.md` | generated | Stage 2 output — concrete test scenarios derived from `plan.md` (overwritten each run) |
| `PIPELINE.md` | reference | Deep-dive on the pipeline architecture and why it isn't triggered automatically today |
| `README.md` | reference | This file |

### `src/` — pipeline plumbing (used by the agents, not by hand)
| File | Necessity | Function |
|---|---|---|
| `src/config.ts` | required | Central typed config object; reads all env vars, throws early if `GITHUB_TOKEN` is missing |
| `src/types.ts` | required | Shared `RfqaIssue` type (owner/repo/number/title/url/body/status) |
| `src/mcp/githubClient.ts` | required | MCP client over Streamable HTTP to GitHub's hosted MCP server. Exposes `getIssue`, `listRfqaIssues` (label-based RFQA detection only — no Projects v2 support), `parseIssueUrlParam` (decodes a Projects-board URL's `issue=Owner\|Repo\|Number` param), `closeGithubClient`. Used exclusively by `gitReaderAgent` |
| `src/mcp/playwrightMcpClient.ts` | planned, currently empty | Intended as an MCP-based browser client for `testGeneratorAgent` to use beyond stock Playwright; not implemented — the agent falls back to plain `@playwright/test` |
| `src/reporting/evidenceLogger.ts` | planned, currently empty | Intended to attach extra screenshots/traces per test step to `evidence/`; not implemented |
| `src/reporting/reportBuilder.ts` | planned, currently empty | Intended to post-process `allure-results/` into a custom report; not implemented — use `npx allure generate` directly instead |

### `.claude/agents/` — the three pipeline stages
| File | Necessity | Function |
|---|---|---|
| `gitReaderAgent.md` | required | Stage 1: finds the RFQA issue (by number, by Projects-board URL, or by scanning labels), extracts Acceptance Criteria verbatim, writes `plan.md`. Never fabricates criteria if the API call fails |
| `testPlannerAgent.md` | required | Stage 2: reads `plan.md`, maps every Acceptance Criterion to one or more concrete scenarios (`ACn-Sm`) described by role/label/text (not selectors), writes `SCENARIOS.md`. Refuses to run if `plan.md` has no Acceptance Criteria section |
| `testGeneratorAgent.md` | required | Stage 3: reads `SCENARIOS.md`, generates Playwright Page Objects (`tests/pages/`) and specs (`tests/specs/`), runs them, iterates on script-level failures (bad locators, race conditions), reports genuine app-behavior mismatches as real FAILs rather than patching around them. Refuses to run if `SCENARIOS.md` is missing |

### `.github/workflows/`
| File | Necessity | Function |
|---|---|---|
| `rfqa-pipeline.yml` | optional (CI path) | Manually-dispatched (`workflow_dispatch`) GitHub Action that runs the entire pipeline headlessly: installs deps + Playwright + Claude Code CLI, then drives all three agents via a single `claude -p` prompt, runs the generated tests, posts a PASS/FAIL summary as a GitHub issue comment, and uploads the Playwright report / Allure results / generated `plan.md`, `SCENARIOS.md`, `tests/` as artifacts. Not triggered by any GitHub event today — see PIPELINE.md for what would make it fully automatic |

### `tests/`
| Path | Necessity | Function |
|---|---|---|
| `tests/specs/*.spec.ts` | generated | Playwright test files, one per Acceptance Criteria group, produced by `testGeneratorAgent` |
| `tests/pages/*.ts` (created on first generation) | generated | Page Object classes backing the specs, reused/extended across runs rather than duplicated |

### Output directories (gitignored, created by running tests)
| Path | Necessity | Function |
|---|---|---|
| `test-results/` | generated | Raw Playwright Test run output (traces, screenshots, videos on failure) |
| `allure-results/` | generated | Raw Allure result files written by the `allure-playwright` reporter |
| `allure-report/` | generated | Rendered HTML report from `npx allure generate` |
| `evidence/` | generated (currently unused) | Reserved for extra evidence attachments via `evidenceLogger.ts`, which isn't implemented yet |
