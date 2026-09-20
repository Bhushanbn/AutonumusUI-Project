
# Autonomous UI Test — README

## Repositories

- **Acceptance Criteria / GitHub Issues:** https://github.com/Bhushanbn/GitRepo_Acceptance-Criteria.git
- **Automation pipeline (this project):** https://github.com/Bhushanbn/AutonumusUI-Project.git

The pipeline lives entirely in the second repo. The first repo only holds
the issues that trigger it — see "Automatic trigger" for why these being
two separate repos matters for how triggering actually works.

---

## 1. What this project is

An agent-driven QA pipeline that turns a GitHub issue (labeled **RFQA**)
into executed, evidenced Playwright tests — with no test code written by
hand. Stage 1 is deterministic; Stages 2–4 call **Gemini** (free tier) and
run as plain TypeScript scripts under [src/agents/](src/agents/) — not
Claude Code subagents (see §6 for why). Each stage's output is a plain
file or evidence artifact the next stage consumes:

```
GitHub Issue (label: RFQA — see "Trigger limitation" below)
      │  gitReaderAgent        [deterministic — no LLM]
      ▼
   plan.md
      │  testPlannerAgent      [Gemini — one call]
      ▼
   SCENARIOS.md
      ├──────────────────────────────┬─────────────────────────────┐
      │  testGeneratorAgent          │  executionAgent              │
      │  [Gemini — generate→run→fix] │  [Gemini + Playwright MCP —  │
      │                              │   live, per-action loop]     │
      ▼                              ▼
 tests/pages, tests/specs      evidence/execution_log.txt,
      │                        evidence/execution-report.md,
      │  npm test               evidence/screenshots/
      ▼
 evidence/  ← single, self-contained artifact (everything lands here)
      │
      ▼
 postComment.mjs → PASS/FAIL table posted on the GitHub issue
```

Two independent consumers of `SCENARIOS.md`: `testGeneratorAgent` produces
a **static, checked-in regression suite** (no LLM at test-run time).
`executionAgent` produces a **live, autonomous run** where an LLM decides
each browser action in real time — the piece that actually satisfies the
assignment's "explore the UI, execute the tests" / "agent's thought
process" requirements; the static suite alone does not.

### Which stages are actually "agents"

All four are labeled "agent" for naming consistency, but they don't all
behave the same way. A system is genuinely agentic only when an LLM
decides the next action based on live environment feedback, repeatedly,
for an unpredetermined number of steps:

- `gitReaderAgent` — **not an agent.** Fixed sequence, zero LLM.
- `testPlannerAgent` — **not an agent.** One LLM call, one output, no loop.
- `testGeneratorAgent` — **partially agentic.** A real feedback loop
  (generate → run → observe real failure → regenerate), narrowly scoped.
- `executionAgent` — **the real thing.** Neither the step count nor which
  actions happen is decided in advance; the model discovers that live,
  action by action, against the actual running application.

---

## 2. Setup from scratch

### Prerequisites
- Node.js 20+ and npm
- A GitHub **personal access token** — `repo` scope (classic) or
  fine-grained with Issues: Read & write, Contents: Read-only
- A **Gemini API key** — free tier, no billing account required, from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Steps
```bash
git clone https://github.com/Bhushanbn/AutonumusUI-Project.git
cd AutonumusUI-Project
npm install
npx playwright install --with-deps chromium

cp .env.example .env
# edit .env — fill in GITHUB_TOKEN and GEMINI_API_KEY at minimum
```

### `.env` reference

| Variable | Required | Default | Used by |
|---|---|---|---|
| `GITHUB_TOKEN` | Yes | — | `githubClient.ts`, `postComment.mjs` |
| `GEMINI_API_KEY` | Yes (Stages 2–4 only) | — | `geminiClient.ts` |
| `GEMINI_MODEL` | No | check current free-tier model at aistudio.google.com — has already changed once mid-project | `geminiClient.ts` |
| `GITHUB_ISSUE_NUMBER` | No | auto-discovers first open RFQA-labeled issue if unset | `gitReaderAgent.ts` |
| `GITHUB_OWNER` / `GITHUB_REPO` | No | `Bhushanbn` / `GitRepo_Acceptance-Criteria` | `gitReaderAgent.ts` |
| `GITHUB_RFQA_STATUS` | No | `Ready for QA` | `isReadyForQA()` — label text, not a Projects field, see §7 |
| `APP_BASE_URL` | No | `https://www.saucedemo.com` | `playwright.config.ts`, `executionAgent.ts` |

### Running it — test locally, stage by stage, before CI
```bash
npm run agent:read       # 1. plan.md, no LLM
npm run agent:plan       # 2. SCENARIOS.md, one Gemini call
npm run agent:generate   # 3. tests/pages + tests/specs, generate→run→fix loop (Gemini)
npm run agent:execute    # 4. live browser run via Gemini + Playwright MCP
npm test                 # 5. full static suite + Allure report + evidence/
npm run report:open      # 6. view the Allure report (served, not opened directly — see §5)
```
`npm run agent:pipeline` chains steps 1–3. Check each stage's output before
moving to the next — don't jump straight to `npm test` if something
upstream looks wrong.

### CI
Two repo secrets on `AutonumusUI-Project`: `GH_PAT` and `GEMINI_API_KEY`.
Dispatch `.github/workflows/rfqa-pipeline.yml` manually first
(`workflow_dispatch` with `owner`/`repo`/`issue_number` inputs) before
relying on the automatic label-triggered path (not fully wired up yet —
see §7/§8).

---

## 3. Architecture — stage by stage

### Stage 1 — gitReaderAgent
**Defined in:** [src/agents/gitReaderAgent.ts](src/agents/gitReaderAgent.ts) (run via `npm run agent:read`; original design in [.claude/agents/gitReaderAgent.md](.claude/agents/gitReaderAgent.md), reference-only)
**LLM used:** none — deterministic extraction, by design

- Talks to GitHub via [src/mcp/githubClient.ts](src/mcp/githubClient.ts), a
  hand-rolled MCP client over Streamable HTTP to GitHub's *hosted* MCP
  server (`https://api.githubcopilot.com/mcp/`), authenticated with
  `GITHUB_TOKEN`. Entirely LLM-agnostic — needed no change during the
  Gemini migration.
- `resolveIssue()` fetches either a specific issue (`GITHUB_ISSUE_NUMBER`
  set) or scans open issues via `listRfqaIssues()`, which filters by an
  `RFQA`/`Ready for QA` **label** (see §7 for why label-only, and a known
  quirk: the hosted MCP server returns `labels` as plain strings, not
  `{name: string}` objects like GitHub's REST API — the filter handles
  both shapes).
- `isReadyForQA()` is the **single enforcement gate for the whole
  pipeline** — nothing downstream re-checks RFQA status. Applied uniformly
  after `resolveIssue()` regardless of which path found the issue (an
  explicit `GITHUB_ISSUE_NUMBER` fetch has no filtering of its own, so
  this check is what actually stops a non-RFQA issue being processed).
- `extractSection()`/`extractAcceptanceCriteria()` parse the issue body
  **line by line**, tolerant of multiple real-world markdown conventions
  (`##` headings, `**bold**` headings, or bare heading text; `- AC1:`
  bullets or bare `AC1:` lines) — broadened after two real issues in this
  project's own tracker used two different conventions.
- Output: overwrites `plan.md` with issue title/number, source URL,
  verbatim Acceptance Criteria (renumbered sequentially), and any explicit
  notes/constraints — never fabricates criteria; throws instead.

### Stage 2 — testPlannerAgent
**Defined in:** [src/agents/testPlannerAgent.ts](src/agents/testPlannerAgent.ts) (original design in [.claude/agents/testPlannerAgent.md](.claude/agents/testPlannerAgent.md), reference-only)
**LLM:** Gemini, free tier — one `generateText()` call, no tool-use needed

- Reads `plan.md`'s `## Acceptance Criteria` section; throws if missing.
- Maps every criterion to one or more scenarios (`ACn-Sm` IDs) —
  Preconditions / User Actions / Expected Validation Checkpoints,
  described by visible roles/labels/text, deliberately **not**
  CSS/XPath selectors, so Stages 3 and 4 can both use accessible locators.
- The system instruction demands an **exact** output structure — this is
  what makes [src/llm/scenarioParser.ts](src/llm/scenarioParser.ts) (Stage
  4) able to parse the file back into structured data at all.
- Output: overwrites `SCENARIOS.md` in full every run.

### Stage 3 — testGeneratorAgent
**Defined in:** [src/agents/testGeneratorAgent.ts](src/agents/testGeneratorAgent.ts) (original design in [.claude/agents/testGeneratorAgent.md](.claude/agents/testGeneratorAgent.md), reference-only)
**LLM:** Gemini, free tier

- Reads `SCENARIOS.md` (+ `plan.md` for wording); refuses to run if
  `SCENARIOS.md` is missing.
- Generates a Page Object Model: `tests/pages/<Feature>Page.ts` per
  screen, `tests/specs/<feature>.spec.ts` per AC group, one `test()` per
  scenario ID. Existing Page Objects are read and fed back into the
  prompt so Gemini extends rather than duplicates them. Files come back
  as `// FILE: path` delimited text, not JSON — avoids escaping code
  inside JSON strings.
- Runs `npx playwright test <specs> --reporter=line` via
  `child_process.spawnSync`; on failure, sends the failure output back to
  Gemini for one corrected regeneration — capped at
  `MAX_FIX_ITERATIONS = 2`. Every fix-iteration prompt explicitly forbids
  weakening an assertion just to force a pass — a genuine app-behavior
  mismatch should surface as a real reported failure.
- [src/mcp/playwrightMcpClient.ts](src/mcp/playwrightMcpClient.ts) and
  [src/reporting/evidenceLogger.ts](src/reporting/evidenceLogger.ts)/[reportBuilder.ts](src/reporting/reportBuilder.ts)
  were reserved for this stage but ended up unused — Playwright MCP is
  used by Stage 4 instead, and evidence is built after the fact by
  `buildEvidence.mjs`.

### Stage 4 — executionAgent (live, autonomous execution)
**Defined in:** [src/agents/executionAgent.ts](src/agents/executionAgent.ts) (entry point) + [src/agents/executionLoop.ts](src/agents/executionLoop.ts) (the loop) + [src/agents/evidenceRecorder.ts](src/agents/evidenceRecorder.ts) (logging)
**LLM:** Gemini, via raw `getGeminiClient()` (multi-turn tool-calling — `generateText()`/`generateJSON()` don't expose `tools`/`toolConfig`)
**Execution tool:** Playwright MCP (`@playwright/mcp`) via [src/mcp/playwrightMcpClient.ts](src/mcp/playwrightMcpClient.ts)

This stage exists specifically because Stage 3's output can't satisfy the
assignment's actual wording — *"explore the UI, execute the tests"*, with
evidence of *"the agent's thought process."* A pre-generated spec reasons
once, before the browser opens, then runs mechanically; `executionAgent`
is where an LLM decides **live, per action**.

- `executionAgent.ts` reads `SCENARIOS.md` via `scenarioParser.ts` (lives
  under `src/llm/`, not `src/agents/`, despite being consumed by an
  agent), connects once to Playwright MCP, loops all scenarios with a
  fresh `browser_navigate` per scenario.
- `executionLoop.ts`'s `runScenario()` — per turn: Gemini gets the full
  MCP tool list (converted to `FunctionDeclaration`s via direct
  JSON-Schema pass-through — `parametersJsonSchema` accepts raw JSON
  Schema, no translation layer needed) plus one custom tool,
  `finishTestDeclaration`, for ending the scenario with a verdict.
  - `automaticFunctionCalling: { disable: true }` — **deliberate.** The
    SDK's automatic mode would run the whole loop invisibly, hiding
    exactly the per-step reasoning/screenshot/guardrail behavior this
    stage exists to produce.
  - `toolConfig.mode: ANY` forces a tool call every turn.
  - Guardrails: a hard turn cap, and an abort if the exact same tool call
    repeats three times in a row.
  - A screenshot is forced after every action regardless of whether the
    model requested one.
  - The per-turn Gemini call is wrapped in `withGeminiRetry()` to survive
    transient `503` overload — **not** the daily `429` quota limit, which
    isn't retryable.
- `evidenceRecorder.ts`'s `EvidenceLogger` writes
  `evidence/execution_log.txt` (the turn-by-turn "I see X, doing Y"
  reasoning trail), `evidence/screenshots/`, `evidence/execution-report.md`
  — deliberately **separate** from `evidence/report.md` (Stage 3's report,
  see §5): one proves the regression suite passes, the other proves live
  autonomous execution happened.
- `executionLoop.ts` defines its **own** `Scenario` interface rather than
  importing `scenarioParser.ts`'s — decoupling the two. Structurally
  identical today; must be kept in sync by hand if either changes.

---

## 4. Full file & folder reference

### Root
| Path | Purpose |
|---|---|
| `package.json` | Scripts (`agent:read/plan/generate/execute/pipeline`, `test`, `report:*`, `evidence:build`) and deps (`@google/genai`, `@modelcontextprotocol/sdk`, `@playwright/test`, `dotenv`; dev: `@playwright/mcp`, `allure-playwright`, `allure-commandline`, `tsx`, `typescript`). |
| `tsconfig.json` | Should `include` both `src/**/*.ts` and `tests/**/*.ts` — the latter is easy to miss, leaving generated tests outside type-checking. |
| `playwright.config.ts` | `testDir: tests/specs`, chromium only, trace/screenshot/video on failure. Reporters: `list`, `html`, `allure-playwright`, `json` (→ `test-results/results.json`, feeds `buildEvidence.mjs`). |
| `.env` / `.env.example` | Secrets and config, see §2. |
| `plan.md` / `SCENARIOS.md` | **Generated**, overwritten each run. |

### `.claude/agents/` — historical, not executed
Three `.md` files — the original Claude Code subagent definitions, each
carrying a note that it's reference-only. The pipeline runs the plain
scripts under `src/agents/` instead (see §6).

### `.github/workflows/rfqa-pipeline.yml`
Triggers on manual `workflow_dispatch` or `repository_dispatch` (type
`rfqa-ready`). Runs all four `npm run agent:*` stages, `npm test`, posts
the result comment, uploads **one** artifact: `evidence/` (previously
three additional separate artifacts — trimmed, see §6).

### `src/config.ts`
`github.token` validated eagerly (throws at import time); `gemini.apiKey`
left optional here and validated lazily inside `geminiClient.ts`, so
`gitReaderAgent` can run without a Gemini key present. (This asymmetry is
an open item, §8.)

### `src/types.ts`
`RfqaIssue` — the shape `githubClient.ts` returns, `gitReaderAgent.ts`
consumes.

### `src/mcp/githubClient.ts`
`getIssue()`, `listRfqaIssues()`, `closeGithubClient()`. See Stage 1 above
for the label-shape bug this file had and fixed.

### `src/mcp/playwrightMcpClient.ts`
Spawns `@playwright/mcp` over stdio for Stage 4 — see Stage 4 above.

### `src/llm/geminiClient.ts`
Single choke point for all Gemini access: `getGeminiClient()` (raw client
for Stage 4), `withGeminiRetry()` (shared retry for transient `503`s,
used by both Stages 2–3's `generateText()` and Stage 4's loop),
`generateText()`/`generateJSON()` (single-shot, Stages 2–3).

### `src/llm/finishTestTool.ts`
`finishTestDeclaration` — Stage 4's one non-MCP tool.

### `src/llm/scenarioParser.ts`
`SCENARIOS.md` → structured `Scenario[]` for Stage 4. Round-trips through
markdown rather than being generated as JSON directly — a known fragile
pattern, not yet addressed (§8).

### `src/reporting/evidenceLogger.ts`, `src/reporting/reportBuilder.ts`
Empty stubs, unused — superseded by `scripts/buildEvidence.mjs` and manual
`allure generate` calls.

### `tests/pages/`, `tests/specs/`
Generated by `testGeneratorAgent`, committed as a working example.
`getByRole`/`getByLabel`/`getByText` locators only; assertions live only
in spec files.

### `scripts/run-tests.mjs`
Runs, regardless of intermediate exit codes: `playwright test`, `allure
generate`, `node scripts/buildEvidence.mjs`. On Windows, only `playwright`
and `allure` get a `.cmd` suffix — `node` is a real executable and must
never get one (real bug hit and fixed, §6).

### `scripts/buildEvidence.mjs`
Builds the single, self-contained `evidence/` folder — full contents in
§5. Previously only copied `test-results/`/`playwright-report/`/`allure-report/`;
now also copies `allure-results/` and `plan.md`/`SCENARIOS.md`/`tests/`
(as `generated/`), so the separate top-level CI artifacts that used to
exist alongside `evidence/` could be retired.

### `scripts/postComment.mjs`
Posts a per-scenario `| Scenario | Verdict |` table (parsed from
`evidence/report.md`'s test-results table) plus a CI run link, via plain
REST. Exits `0` on missing env vars rather than failing.

---

## 5. Evidence — one self-contained folder

`evidence/` is the **only** thing CI uploads as an artifact:

```
evidence/
  report.md                 static suite's pass/fail summary (from test-results/results.json)
  execution-report.md       executionAgent's own pass/fail summary (Stage 4)
  execution_log.txt         executionAgent's turn-by-turn reasoning trail
  screenshots/              executionAgent's per-action screenshots
  test-results/             raw traces/screenshots/videos for static-suite failures
  playwright-report/        Playwright's static HTML report
  allure-report/            Allure's static HTML report
  allure-results/           Allure's raw result files
  generated/
    plan.md                 Stage 1's output, copied in
    SCENARIOS.md             Stage 2's output, copied in
    tests/                   Stage 3's generated Page Objects + specs
```

**Known quirk:** the Allure report inside `evidence/allure-report/` shows a
blank white page if opened directly (double-clicking `index.html`) —
Allure's static report loads data via `fetch()` calls to adjacent JSON
files, which browsers block over `file://`. Serve it instead:
```bash
npx http-server evidence/allure-report -p 5050
```
then open the printed `localhost` URL. This is a property of Allure's
report format, not something specific to this project.

---

## 6. What changed from the original setup, and why

### The original design
Three Claude Code subagents (`.claude/agents/*.md`), executed by Claude
Code's own runtime, which supplied the tool-calling loop, MCP connections,
and context management for free.

### Why it changed
Claude Code's non-interactive CI authentication requires a paid Claude
subscription (`CLAUDE_CODE_OAUTH_TOKEN`) or a billed Anthropic API key — a
free `claude.ai` account covers neither, which blocked the original
GitHub Actions run at the AI-execution stage.

### What actually moved to Gemini, and what didn't
Only stages involving genuine LLM reasoning needed rewiring:
`testPlannerAgent`, `testGeneratorAgent`, and (added afterward, below)
`executionAgent`. `gitReaderAgent` needed **no LLM-related change at
all** — it was always deterministic parsing.

### Why `executionAgent` was added after the Gemini migration
The migration alone reproduced a working pipeline, but not one satisfying
*"explore the UI, execute the tests"* / *"the agent's thought process."*
`testGeneratorAgent` reasons once, before the browser opens;
`executionAgent` is where an LLM decides live, per action — the only one
of the four stages agentic by the strict definition (§1).

### Real bugs found and fixed along the way
1. **`gitReaderAgent`'s RFQA gate had no enforcement on the
   explicit-issue-number path.** Fixed with an explicit `isReadyForQA()`
   check applied uniformly after `resolveIssue()`.
2. **A section-extraction regex used the `"m"` flag**, silently
   truncating whichever section was last in a document to just its first
   line. Fixed by moving to line-by-line iteration, removing the
   ambiguity structurally.
3. **The issue-body parser assumed one fixed markdown convention.** A
   second real issue used a different one (plain-text heading, no
   leading dash on AC lines). Fixed by broadening both matchers.
4. **The hosted GitHub MCP server returns issue `labels` as plain
   strings**, not `{name: string}` objects — the original filter's
   `l.name` silently evaluated to `undefined`, so RFQA filtering never
   matched despite a correct label. Fixed by handling both shapes.
5. **`run-tests.mjs` appended `.cmd` to every command on Windows,
   including `node`** — `node.cmd` doesn't exist, so evidence-building
   silently failed every run. Fixed by only suffixing the two commands
   that actually need it.
6. **The Gemini model name became unavailable to new users mid-project**
   (`gemini-2.5-flash` → `gemini-3.6-flash`), and the replacement then hit
   both transient `503` overload and a genuine `20/day` free-tier `429`
   quota limit. Addressed with `withGeminiRetry()` for the transient
   case; the daily quota has no code fix — a real free-tier constraint.
7. **Two files' contents got swapped** (`run-tests.mjs` ended up
   containing `buildEvidence.mjs`'s logic and vice versa) during manual
   editing. Caught by checking each file's actual content directly.
8. **Four separate CI artifacts duplicated what `evidence/` was meant to
   be the one place for.** Fixed by extending `buildEvidence.mjs` to copy
   `allure-results/` and `plan.md`/`SCENARIOS.md`/`tests/` into
   `evidence/`, then trimming the workflow to one `Upload evidence` step.
9. **Allure's HTML report shows a blank page when opened directly** — a
   property of Allure's report format (browsers block `file://` `fetch()`
   calls), not a project bug; documented with the fix (serve it) rather
   than "fixed" in code.
10. **The GitHub Actions comment only posted a one-line pass/fail
    count.** Extended `postComment.mjs` to post a full per-scenario
    verdict table instead.

---

## 7. Trigger limitation — label-based only, not Projects v2 Status

**Current, real behavior, not an oversight:** moving a Projects (v2)
board card's Status column to "Ready for QA" does **not** trigger
anything. Only adding the literal `RFQA` label does. Two independent
reasons — fixing only one would not be enough on its own:

1. **Detection.** `githubClient.ts` talks to GitHub's *hosted* MCP
   server, whose `list_issues`/`get_issue` tools expose no Projects v2
   data at all. `RfqaIssue.status` isn't independently fetched —
   `listRfqaIssues()` hardcodes it to `config.github.rfqaStatusValue` the
   moment the **label** filter already matched. No code path currently
   reads a real Projects v2 field.
2. **CI trigger event.** Even with Status-field reading added, the
   automatic-dispatch companion workflow (`notify-rfqa.yml`) listens for
   `on: issues: types: [labeled]`. A Projects v2 Status change fires a
   completely different event, `projects_v2_item: edited`.

**To add real Status-field support** (not currently implemented):
1. Add a plain `octokit.graphql()` call in `githubClient.ts` (bypassing
   the hosted MCP server — it can't do this), querying
   `repository.issue(number).projectItems.nodes.fieldValueByName(name:
   "Status")`. Requires a `read:project`-scoped token.
2. Change `notify-rfqa.yml`'s trigger to `on: projects_v2_item: types:
   [edited]`, and filter for the Status field specifically changing to
   "Ready for QA" (a `projects_v2_item` event fires on *any* field edit).

Until built, label the issue `RFQA` to trigger the pipeline.

---

## 8. Automatic trigger — cross-repo label → Actions dispatch

The Acceptance Criteria issues live in `GitRepo_Acceptance-Criteria`,
while the pipeline lives in `AutonumusUI-Project`. A GitHub Actions event
trigger only fires within the repo hosting the workflow file, so the
automatic path needs two cooperating workflows and a `repository_dispatch`
bridge:

```
GitRepo_Acceptance-Criteria                    AutonumusUI-Project (this repo)
──────────────────────────                     ──────────────────────────────
Issue labeled RFQA
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
                                               from client_payload, runs all
                                               four stages + tests, posts
                                               PASS/FAIL comment, uploads
                                               evidence/
```

## 9. End-to-end flow, narrated

1. An issue in `GitRepo_Acceptance-Criteria` gets labeled `RFQA` (moving a
   Status column alone does nothing — §7).
2. **Stage 1** (no LLM): fetches the issue, checks the RFQA gate,
   extracts User Story + Acceptance Criteria, writes `plan.md`.
3. **Stage 2** (one Gemini call): reads `plan.md`, writes `SCENARIOS.md`.
4. **Stages 3 and 4 run independently** off the same `SCENARIOS.md` —
   Stage 3 generates/updates the checked-in suite and self-corrects on
   failure; Stage 4 runs a live decide→act→observe loop per scenario,
   producing the reasoning log, screenshots, and grounded verdicts.
5. `npm test` runs the static suite, builds the HTML reports, and
   populates the single `evidence/` folder.
6. `postComment.mjs` posts a per-scenario verdict table on the original
   issue, linking to the CI run.
7. CI uploads exactly one artifact: `evidence/`.

---

## 10. Open items (known, not yet addressed)

- **Status-field (Projects v2) triggering** — needs a GraphQL query and a
  different CI event type (§7).
- **`github.token`'s eager validation** — unlike `gemini.apiKey`, any
  script importing `config.ts` fails immediately if `GITHUB_TOKEN` is
  missing, even Stages 2–4, which never touch GitHub.
- **`scenarioParser.ts`'s markdown round-trip** — a more robust
  alternative (generate scenario data as JSON via `generateJSON()`,
  render `SCENARIOS.md` forward from that rather than parsing it
  backward) was discussed but not implemented.
- **`GEMINI_MODEL`'s value is a moving target** — this project already
  hit one mid-build model retirement. Treat the current default as
  provisional.
- **Free-tier Gemini quota** (as low as 20 requests/day for a given
  model) meaningfully limits how many full pipeline iterations are
  practical per day during active development — a real tradeoff of the
  no-billing-account migration, not a bug.
