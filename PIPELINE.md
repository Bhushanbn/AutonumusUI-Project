# Autonomous UI Test Pipeline — Setup & Architecture

## What this project is

A three-stage, agent-driven QA pipeline that turns a GitHub issue marked "Ready
for QA" into executed, evidenced Playwright tests, with no test code written
by hand. Each stage is a Claude Code **subagent** defined under
[.claude/agents/](.claude/agents/), and each stage's output is a plain file
that becomes the next stage's input:

```
GitHub Issue (label: RFQA / "Ready for QA")
        │  gitReaderAgent
        ▼
   plan.md                  (Acceptance Criteria, verbatim)
        │  testPlannerAgent
        ▼
   SCENARIOS.md              (concrete, role/label-based test scenarios)
        │  testGeneratorAgent
        ▼
   tests/pages/*.ts + tests/specs/*.spec.ts   (Playwright POM + specs)
        │  npx playwright test
        ▼
   test-results/, allure-results/, evidence/   (pass/fail + evidence)
```

## Stage 1 — gitReaderAgent

**Defined in:** [.claude/agents/gitReaderAgent.md](.claude/agents/gitReaderAgent.md)
**Tools it may use:** Read, Write, Bash, Grep, Glob (no network/MCP tool access directly — it shells out to a script instead)

- Talks to GitHub via [src/mcp/githubClient.ts](src/mcp/githubClient.ts), which is a
  hand-rolled MCP client (`@modelcontextprotocol/sdk`) connecting over
  **Streamable HTTP** to GitHub's *hosted* MCP server at
  `https://api.githubcopilot.com/mcp/`, authenticated with a bearer token from
  `GITHUB_TOKEN`.
- Exposes two entry points the agent calls via `npx tsx`:
  - `getIssue(owner, repo, number)` — direct fetch by number, via the MCP `issue_read` tool.
  - `listRfqaIssues(owner, repo)` — lists open issues and filters by an `RFQA` /
    `Ready for QA` **label** (case-insensitive).
- **Important limitation baked into the code and the agent's own instructions:**
  the hosted GitHub MCP server's default toolset does not expose GitHub
  Projects (v2) tools. So this agent **cannot read a Projects-board "Status"
  column** — only issue *labels*. If your board moves cards by Status field
  only (no matching label), this agent has no way to detect "Ready for QA"
  on its own and needs either a labeled issue or a pasted Projects-board URL
  (`parseIssueUrlParam` decodes the `issue=Owner|Repo|Number` query param from
  such a URL).
- Output: overwrites `plan.md` at repo root with Issue title/number, source
  URL, verbatim Acceptance Criteria (numbered), and any explicit
  constraints — never fabricates criteria if the API call fails.

## Stage 2 — testPlannerAgent

**Defined in:** [.claude/agents/testPlannerAgent.md](.claude/agents/testPlannerAgent.md)
**Tools:** Read, Write, Grep, Glob (no Bash, no network — pure text transformation)

- Reads `plan.md`'s `## Acceptance Criteria` section. Refuses to run (and says
  so) if that section doesn't exist yet — enforcing stage ordering by
  convention, not by any programmatic gate.
- Maps every criterion to one or more scenarios (`ACn-Sm` IDs), each with
  Preconditions / User Actions / Expected Validation Checkpoints, described in
  terms of visible roles/labels/text — deliberately **not** CSS/XPath
  selectors, so Stage 3 can use Playwright's accessible locators instead of
  brittle ones.
- Output: overwrites `SCENARIOS.md` in full every run.

## Stage 3 — testGeneratorAgent

**Defined in:** [.claude/agents/testGeneratorAgent.md](.claude/agents/testGeneratorAgent.md)
**Tools:** Read, Write, Edit, Bash, Grep, Glob

- Reads `SCENARIOS.md` (and `plan.md` for the source wording), refuses to run
  if `SCENARIOS.md` is missing.
- Generates a Page Object Model: `tests/pages/<Feature>Page.ts` per screen,
  `tests/specs/<feature>.spec.ts` per AC group, one `test()` per scenario ID.
- Was designed to optionally use a **Playwright MCP client** at
  [src/mcp/playwrightMcpClient.ts](src/mcp/playwrightMcpClient.ts) and an
  **evidence logger** at [src/reporting/evidenceLogger.ts](src/reporting/evidenceLogger.ts)
  for attaching screenshots/traces to `evidence/` beyond what stock
  `@playwright/test` captures — **but both files are currently empty
  stubs**, so in practice the agent falls back to plain `@playwright/test`
  (trace/screenshot/video config already present in
  [playwright.config.ts](playwright.config.ts)).
- Runs `npx playwright test tests/specs/<file>.spec.ts --reporter=line`
  itself, diagnoses failures (locator vs. timing vs. genuine app-behavior
  mismatch), and iterates a bounded number of times before reporting a
  blocker instead of thrashing. It will not weaken assertions just to force
  a pass.
- Reporting: `allure-playwright` writes to `allure-results/`; turned into a
  browsable report via `reportBuilder.ts` / the `allure-commandline` package
  (`npx allure generate ./allure-results --clean -o ./allure-report`).

## Supporting pieces

| File | Role |
|---|---|
| [src/config.ts](src/config.ts) | Central env-driven config: `GITHUB_TOKEN` (required, throws if absent), `GITHUB_MCP_URL`, `GITHUB_OWNER`/`GITHUB_REPO`, `GITHUB_PROJECT_NUMBER`, `GITHUB_RFQA_STATUS`, `APP_BASE_URL` |
| [src/types.ts](src/types.ts) | `RfqaIssue` shape shared by the GitHub client and (implicitly) `plan.md` generation |
| [playwright.config.ts](playwright.config.ts) | `testDir: tests/specs`, chromium only, trace/screenshot/video on failure, `allure-playwright` reporter, `baseURL` from `APP_BASE_URL` (defaults to saucedemo.com) |
| `.env` (not committed) | Supplies `GITHUB_TOKEN` and friends to `src/config.ts` |

## Why you weren't able to trigger the workflow automatically

There is currently **no automatic trigger wired up anywhere** — everything
here only runs because a person types a prompt that happens to match an
agent's `description` trigger phrases. Concretely:

1. **No hooks configured.** `.claude/settings.json` / `settings.local.json`
   don't exist in this project. Claude Code hooks are the only mechanism that
   lets the harness itself react to events (a file save, a git action, a
   session start) without a human prompting — none are defined, so nothing
   fires on its own.
2. **No scheduled/cron job.** There's no `CronCreate`-based routine or `/loop`
   set up to periodically poll GitHub for issues that just became RFQA. The
   pipeline is purely reactive to being asked.
3. **No GitHub webhook / CI integration.** Nothing in this repo (no GitHub
   Actions workflow, no webhook receiver) listens for the issue's label or
   Project Status changing to "Ready for QA" and kicks off Claude Code from
   the outside. `src/mcp/githubClient.ts` only *reads* issues on demand — it's
   never invoked by an external event.
4. **Agents only self-select on matching prose, and only when directly
   invoked.** Claude Code picks a subagent when your prompt's wording matches
   its `description` (e.g. "read the RFQA issue"), but that matching happens
   per-conversation-turn, initiated by you — subagents don't wake themselves
   up, watch the filesystem, or watch GitHub in the background.
5. **The Projects-board Status field genuinely isn't queryable.** Even if you
   did wire up polling, the hosted GitHub MCP server's default toolset (used
   by `githubClient.ts`) has no Projects v2 tools, so "card moved to Ready for
   QA on the board" can't be detected at all through this code path — only an
   issue *label* can. So even an automatic trigger would need to be
   label-based (e.g. a GitHub Action on `issues: labeled`) rather than
   Status-field-based, unless someone adds a local `github-mcp-server` run
   with the `projects` toolset enabled and new project-item calls in
   `githubClient.ts`.

**In short:** the three agents form a real, working pipeline, but the wiring
between "issue becomes RFQA" and "pipeline runs" doesn't exist yet — every
stage still needs a human (or an external trigger you'd have to build, e.g. a
GitHub Action calling out to Claude Code, or a Claude Code hook/cron polling
`listRfqaIssues`) to say "go."

## Manual run sequence (today)

```
1. Use gitReaderAgent to read GitHub issue #<n> and write its acceptance criteria into plan.md
2. Use testPlannerAgent to generate test scenarios from plan.md into SCENARIOS.md
3. Use testGeneratorAgent to generate and run tests from SCENARIOS.md
4. npx playwright test
5. npx allure generate ./allure-results --clean -o ./allure-report && npx allure open ./allure-report
```

## What would need to be added for real automation

- A GitHub Action on `issues.labeled` (label = `RFQA`/`Ready for QA`) that
  invokes Claude Code headlessly (or posts to a webhook you host) passing the
  issue number — replacing "a human types the Stage 1 prompt."
- Or a Claude Code **cron/scheduled routine** (`CronCreate`, or the `schedule`
  skill) that periodically calls `listRfqaIssues` and, for any new one, drives
  Stages 1–3 in sequence.
- Either way, Stage 2 and 3 already chain cleanly off Stage 1's file outputs,
  so only the "what starts Stage 1" gap needs closing.
