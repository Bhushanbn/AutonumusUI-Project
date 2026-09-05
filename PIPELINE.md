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

## Automatic trigger — cross-repo label → Actions dispatch (current design)

The Acceptance Criteria issues live in a **separate** repo,
`Bhushanbn/GitRepo_Acceptance-Criteria`, while this pipeline lives in
`Bhushanbn/Autonomous_UI_Test`. A GitHub Actions event trigger (`issues:
labeled`, etc.) only fires within the repo hosting the workflow file, so a
single workflow can't listen across repos directly — the automatic path
needs two cooperating workflows and a `repository_dispatch` bridge between
them:

```
GitRepo_Acceptance-Criteria                    Autonomous_UI_Test (this repo)
──────────────────────────                     ──────────────────────────────
Issue labeled RFQA/Ready for QA
        │
        ▼
notify-rfqa.yml  (on: issues.labeled)
  - filters on label name
  - repository-dispatch call  ────────────►   rfqa-pipeline.yml
                                               (on: repository_dispatch,
                                                types: [rfqa-ready])
                                                      │
                                                      ▼
                                               reads owner/repo/issue_number
                                               from client_payload, runs the
                                               full 3-agent pipeline + tests
                                               + posts PASS/FAIL comment back
                                               on the original issue
```

**This repo's side — [.github/workflows/rfqa-pipeline.yml](.github/workflows/rfqa-pipeline.yml) — is implemented:**
- Triggers on `workflow_dispatch` (manual, with `owner`/`repo`/`issue_number`
  inputs) **or** `repository_dispatch` with type `rfqa-ready`.
- `GITHUB_OWNER` / `GITHUB_REPO` / `ISSUE_NUMBER` resolve from
  `inputs.*` when manually dispatched, falling back to
  `github.event.client_payload.*` when dispatched externally.
- The job itself is unchanged: install deps → install Playwright + Claude
  Code CLI → run one `claude -p` prompt that drives `gitReaderAgent` →
  `testPlannerAgent` → `testGeneratorAgent` → runs the generated tests →
  posts a PASS/FAIL comment on the original issue → uploads
  Playwright/Allure/generated-file artifacts.

**The other repo's side is NOT yet in place — this is why labeling issue
[#1](https://github.com/Bhushanbn/GitRepo_Acceptance-Criteria/issues/1)
today does nothing.** `GitRepo_Acceptance-Criteria` needs:
1. A new workflow file `.github/workflows/notify-rfqa.yml` on its default
   branch:
   ```yaml
   name: Notify RFQA Pipeline

   on:
     issues:
       types: [labeled]

   jobs:
     dispatch:
       runs-on: ubuntu-latest
       if: contains(fromJSON('["rfqa", "RFQA", "ready for qa", "Ready for QA"]'), github.event.label.name)
       steps:
         - name: Trigger pipeline in automation repo
           uses: peter-evans/repository-dispatch@v3
           with:
             token: ${{ secrets.PIPELINE_DISPATCH_TOKEN }}
             repository: Bhushanbn/Autonomous_UI_Test
             event-type: rfqa-ready
             client-payload: '{"owner": "${{ github.repository_owner }}", "repo": "${{ github.event.repository.name }}", "issue_number": "${{ github.event.issue.number }}"}'
   ```
2. A repo secret `PIPELINE_DISPATCH_TOKEN` in `GitRepo_Acceptance-Criteria`
   (Settings → Secrets and variables → Actions) — a PAT (classic, scopes
   `repo` + `workflow`, or fine-grained with Actions:write on
   `Autonomous_UI_Test`). The default auto-injected `GITHUB_TOKEN` cannot be
   used here since it has no permission to dispatch into a different repo.

Once both exist: labeling an issue `RFQA`/`Ready for QA` in
`GitRepo_Acceptance-Criteria` → `notify-rfqa.yml` runs there → dispatches to
`Autonomous_UI_Test` → `rfqa-pipeline.yml` runs the full pipeline
automatically, no human prompt required.

**Residual limitation (unchanged):** this whole path is label-based, because
the hosted GitHub MCP server used by `src/mcp/githubClient.ts` has no
Projects v2 toolset — a Projects-board "Status" column move (with no
matching label) still can't be detected by anything in this repo. That would
require a `projects_v2_item` webhook + GitHub App instead, which is unbuilt
(see the reserved-but-unused `GITHUB_WEBHOOK_SECRET`/`WEBHOOK_PORT` vars in
`.env.example`).

## Manual run sequence (still works, and is the fallback if the automatic path isn't wired up)

```
1. Use gitReaderAgent to read GitHub issue #<n> and write its acceptance criteria into plan.md
2. Use testPlannerAgent to generate test scenarios from plan.md into SCENARIOS.md
3. Use testGeneratorAgent to generate and run tests from SCENARIOS.md
4. npx playwright test
5. npx allure generate ./allure-results --clean -o ./allure-report && npx allure open ./allure-report
```
Or dispatch [.github/workflows/rfqa-pipeline.yml](.github/workflows/rfqa-pipeline.yml)
manually from the Actions tab with `owner`/`repo`/`issue_number` inputs —
this works today regardless of whether `notify-rfqa.yml` exists yet.
