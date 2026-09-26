# Autonomous UI Test Project
## Complete Agent, LLM, Function, and Data Flow

## 1. Project Summary

This project is an agent-driven UI testing pipeline. It starts with acceptance criteria stored in a GitHub issue and converts them into executable Playwright tests and browser-execution evidence.

The pipeline has two testing paths:

- A deterministic Playwright regression path.
- A live Gemini-driven browser execution path.

Only Gemini is used as the LLM. Some components do not use an LLM and instead provide deterministic parsing, browser communication, or reporting.

## 2. High-Level Flow

```text
GitHub Issue labeled RFQA
        |
        v
    gitReaderAgent
        |
        | creates plan.md
        v
    testPlannerAgent + Gemini
        |
        | creates SCENARIOS.md
        v
        +-----------------------------+
        |                             |
        v                             v
 testGeneratorAgent              executionAgent
        |                             |
        | Gemini generates             | Gemini chooses live
        | Playwright files             | browser actions
        v                             v
 tests/pages + tests/specs       Playwright MCP + browser
        |                             |
        v                             v
 npm test                         execution evidence
        |                             |
        +-------------+-------------+
                      v
                evidence/
```

## 3. Stage 1: gitReaderAgent

### Responsibility

Reads a GitHub issue, validates that it is ready for QA, extracts the issue information, and creates `plan.md`.

### LLM usage

No LLM is used. This stage is deterministic because it performs data retrieval and Markdown parsing.

### Entry command

```bash
npm run agent:read
```

### Call chain

```text
main()
  -> runGitReaderAgent()
      -> resolveIssue() -chooses whicjh metjod to use
          -> getIssue() OR listRfqaIssues()
      -> isReadyForQA() - returns boolean
      -> extractSection() - extracts header, notes 
      -> extractAcceptanceCriteria()
      -> renderPlanMarkdown()  - combines everything
      -> writeFileSync("plan.md", ...)
      -> returns RfqaIssue | null
```

### Important functions

#### `resolveIssue()`

Chooses how to find the issue:

- If `GITHUB_ISSUE_NUMBER` exists, calls `getIssue()`.
- Otherwise, calls `listRfqaIssues()` and selects the first matching issue.

Returns:

```ts
Promise<RfqaIssue | null>
```

#### `getIssue()` / `listRfqaIssues()`

Located in `src/mcp/githubClient.ts`. They call GitHub MCP.

Returns:

```ts
Promise<RfqaIssue>
Promise<RfqaIssue[]>
```

#### `isReadyForQA()`

Checks whether the issue status is `Ready for QA` or `RFQA`.

Returns:

```ts
boolean
```

#### `extractSection()`

Extracts sections such as User Story or Notes.

Returns:

```ts
string | null
```

#### `extractAcceptanceCriteria()`

Extracts acceptance criteria from multiple Markdown formats.

Returns:

```ts
string[]
```

#### `renderPlanMarkdown()`

Combines the issue metadata, user story, acceptance criteria, and notes.

Returns:

```ts
string
```

That string is written to:

```text
plan.md
```

## 4. Stage 2: testPlannerAgent

### Responsibility

Converts acceptance criteria into executable test scenarios.

### LLM usage

Uses Gemini once through `generateText()`.

### Entry command

```bash
npm run agent:plan
```

### Call chain

```text
runTestPlannerAgent() is called checks if existsSync("plan.md")
  if plan.md not found — run gitReaderAgent first.
  -> reads plan.md, 
  -> validates Acceptance Criteria section vai existsSync("plan.md")
  -> generateText()
      -> Gemini -- instructions are passed 
      -> returns Markdown scenario text
  -> writeFileSync("SCENARIOS.md", ...)
  -> returns void
```

### Prompt sent to Gemini

Gemini receives:

- The complete `plan.md` content.
- A system instruction requiring a strict scenario format.

Gemini must produce:

- Scenario ID, such as `AC1-S1`.
- Scenario title.
- Preconditions.
- User actions.
- Expected validation checkpoints.
- Linked acceptance criteria.

### `generateText()`

Located in `src/llm/geminiClient.ts`.

Input:

```ts
{
  systemInstruction: string,
  prompt: string,
  temperature?: number
}
```

Returns:

```ts
Promise<string>
```

The returned Markdown is written to:

```text
SCENARIOS.md
```

## 5. Stage 3: testGeneratorAgent

### Responsibility

Generates Page Object classes and Playwright test specifications from the scenarios.

### LLM usage

Uses Gemini for initial code generation and for one correction attempt when generated tests fail.

### Entry command

```bash
npm run agent:generate
```

### Call chain

```text
runTestGeneratorAgent()
-  checks existsSync("SCENARIOS.md"), if no — run testPlannerAgent first.
  -> reads SCENARIOS.md - returns string 
  -> reads plan.md - 
  -> readExistingPageObjects() , if no creates one
  -> builds basePrompt , - The generator creates basePrompt.
        Target application base URL
        plan.md
        SCENARIOS.md
        Existing Page Objects
    == This prompt is sent to Gemini together with SYSTEM_INSTRUCTION. 
  -> agent calls generateText(SYSTEM_INSTRUCTION, baseprompt) via geminiClient.ts
      -> Gemini returns file text
  -> parseGeneratedFiles() -  converts Gemini’s raw response into structured file objects.
  -> writeGeneratedFiles() - writes each returned file to disk.
  -> runPlaywright()
      -> returns passed/output
  -> if failure:
      -> builds fixPrompt
      -> generateText()
          -> Gemini diagnoses failure
      -> parseGeneratedFiles()
      -> writeGeneratedFiles()
      -> runPlaywright() again if fails count definedf in const MAX_FIX_ITERATIONS = 1;
       If Playwright fails, the agent sends the failure output and generated code back to Gemini once. Gemini diagnoses whether the problem is in the test or in the application and returns corrected files when appropriate. The agent runs the corrected files again. A passing result completes Stage 3; a remaining failure is reported without weakening the acceptance criteria.
  -> returns void
```

### `readExistingPageObjects()`

Reads files under `tests/pages/` so Gemini can reuse or extend existing Page Objects.

Returns:

```ts
string
```

### `parseGeneratedFiles()`

Parses Gemini output using markers such as:

```text
// FILE: tests/pages/LoginPage.ts
```

Returns:

```ts
GeneratedFile[]
```

Each object contains:

```ts
{
  path: string,
  content: string
}
```

### `writeGeneratedFiles()`

Creates directories and writes generated files.

Returns:

```ts
void
```

Generated output is stored under:

```text
tests/pages/
tests/specs/
```

### `runPlaywright()`

Runs the generated Playwright specifications using `spawnSync()`.

Returns:

```ts
{
  passed: boolean,
  output: string
}
```

### Failure correction

The current code allows one correction attempt:

```ts
MAX_FIX_ITERATIONS = 1
```

The failure output is sent to Gemini. Gemini is asked to determine whether the failure is caused by:

- Locator problem.
- Timing issue.
- Incorrect precondition.
- Genuine application behavior mismatch.

Gemini is explicitly instructed not to weaken assertions just to force a pass.

## 6. Scenario Parsing

### File

```text
src/llm/scenarioParser.ts
```

### LLM usage

No direct LLM call.

### Responsibility

Converts Gemini's Markdown scenario output into structured TypeScript objects for the live execution agent.

### Call

```ts
parseScenarios(markdown)
```

Input:

```ts
string
```

Returns:

```ts
Scenario[]
```

Each Scenario contains:

```ts
{
  id: string,
  title: string,
  preconditions: string,
  userActions: string[],
  checkpoints: string[],
  linkedAc: string
}
```

If a scenario has no user actions or checkpoints, the parser throws an error.

## 7. Stage 4: 



Gemini → chooses action → Playwright executes action
        ↑                         ↓
        +------ browser result ---+
### Responsibility

Runs scenarios against a live browser while Gemini decides the next browser action at runtime.

### LLM usage

Uses Gemini's raw multi-turn API with function calling.

### Entry command

```bash
npm run agent:execute
```

### Call chain

```text
npm run agent:execute
  ↓
tsx src/agents/executionAgent.ts
  ↓
main()
  ↓
existsSync("SCENARIOS.md")  ===checks if  SCENARIOS.md not found — run agent:plan first.
  ↓
agent reads  readFileSync("SCENARIOS.md") , parseScenarios() is imported from: scenarioParser.ts

  ↓ The input is the full Markdown content of SCENARIOS.md.
parseScenarios() converts Markdown into structured scenario objects.
  ↓  
Splits the Markdown into scenario blocks.
Extracts the scenario ID and title.
Extracts preconditions.
Extracts numbered user actions.
Extracts expected checkpoints.
Extracts the linked acceptance criterion.
Validates that actions and checkpoints exist.
Returns all scenarios.
Scenario[] object  =  contains IDs, actions, preconditions, checkpoints, and linked criteria.
  ↓   

The agent creates: new EvidenceLogger() =  creates evidence/execution_log.txt,  screenshots/
  ↓ via src/mcp/playwrightMcpClient.ts

 
connectPlaywrightMcp() =  starts a connection to the Playwright MCP server.
  ↓
  ↓
Playwright MCP Client provides browser-control tools to the execution loop.

List available browser tools.
Call browser tools.
Receive browser results.
  ↓
agent loops through every scenario: for each scenario:
For each one, it logs the scenario ID and title.
Before running it, the agent navigates to the application:
  ↓
callPlaywrightTool("browser_navigate") =  opens the application at the configured base URL.
  ↓   
This gives each scenario a fresh starting page.
Return value of callPlaywrightTool()
  ↓
runScenario() controls one scenario’s Gemini/browser interaction loop.
The agent loops through every scenario via src/agents/executionLoop.ts
  ↓ 
  returns {
  scenario: string,
  status: "pass" | "fail",
  reasoning: string,
  turnsUsed: number,
  abortedReason?: string
}
  ↓
getGeminiClient() from src/llm/geminiClient.ts == returns the configured singleton Gemini client.
  ↓ we get GoogleGenAI
then getPlaywrightToolDeclarations() is called
  ↓ gets available browser tools and converts them into Gemini function definitions.
  return browser_navigate
browser_snapshot, etc
  ↓
buildScenarioPrompt()=== creates the initial instruction for Gemini.
  ↓
returns Target application URL
Scenario ID and title
Preconditions
User actions
Expected validation checkpoints
Linked acceptance criterion
  ↓
createUserContent()  ==The prompt is converted into Gemini conversation  content:
  ↓
genAI.models.generateContent()  == sends the scenario, tools, and conversation to Gemini.
  ↓
Gemini returns browser function call., Gemini chooses the next action, such as click, type, snapshot, or finish.
  ↓
callPlaywrightTool() ==  sends Gemini’s selected action to Playwright MCP.
  ↓
Playwright MCP  =  performs the requested action in the browser.
  ↓
browser result - contains the page state, text, errors, or screenshot data.
  ↓
EvidenceLogger =records Gemini’s thought, tool call, result, and screenshot.
  ↓
createPartFromFunctionResponse() =  converts the browser result into Gemini-compatible content.
  ↓
Gemini receives browser result
  ↓
 repeat until finishTest, guardrail, or 20 turns The loop continues until a verdict is returned, the agent gets stuck, or the turn limit is reached.
  ↓ 
ScenarioVerdict = contains the scenario ID, pass/fail status, reasoning, and turns used.
  ↓
recordVerdict() =  stores the scenario result for the final report.
  ↓
writeFinalReport() =  writes evidence/execution-report.md.
  ↓
disconnectPlaywrightMcp() =closes the browser MCP connection and cleans up resources.
```
Stage 4 is the live autonomous QA stage. It reads the scenarios generated in Stage 2 and parses them into structured objects. It starts a Playwright MCP browser session and gives Gemini the scenario, the acceptance checkpoints, and the available browser tools. Gemini chooses an action such as taking a snapshot, clicking, typing, or waiting. The framework sends that action to Playwright MCP, receives the browser result, records it, captures a screenshot, and sends the result back to Gemini. Gemini then decides the next action using the updated browser state. This continues until Gemini calls the custom finishTest function. That function returns a structured pass or fail verdict with reasoning and evidence step numbers. The framework records all thoughts, tool calls, browser results, screenshots, and final verdicts in the evidence folder. If Gemini repeats an action, exceeds the turn limit, or never produces a verdict, the scenario fails safely.


### `connectPlaywrightMcp()`

Starts the Playwright MCP server using stdio transport.

Returns:

```ts
Promise<Client>
```

### `runScenario()`

This is the core live execution function.

Returns:

```ts
Promise<ScenarioVerdict>
```

A verdict contains:

```ts
{
  scenario: string,
  status: "pass" | "fail",
  reasoning: string,
  turnsUsed: number,
  abortedReason?: string
}
```

## 8. Detailed `runScenario()` Flow

```text
runScenario()
  -> getGeminiClient()
  -> getPlaywrightToolDeclarations()
  -> buildScenarioPrompt()
  -> createUserContent()
  -> send scenario and tools to Gemini
  -> read Gemini function call
  -> log model thought and tool call
  -> check repeated-action guardrail
  -> if finishTest:
       return ScenarioVerdict
  -> otherwise callPlaywrightTool()
  -> log browser result
  -> save screenshot
  -> createPartFromFunctionResponse()
  -> append browser result to conversation
  -> call Gemini again
```

## 9. Gemini's Live Tool-Calling Loop

Gemini receives:

- Current scenario.
- Acceptance criteria checkpoints.
- Current conversation contents.
- Playwright MCP tool declarations.
- The custom `finishTest` tool.

Gemini can request tools such as:

```text
browser_navigate
browser_snapshot
browser_click
browser_type
browser_take_screenshot
browser_wait_for
finishTest
```

The loop works like this:

```text
Gemini chooses browser tool
        |
        v
callPlaywrightTool()
        |
        v
Playwright MCP controls browser
        |
        v
Browser result returns
        |
        v
createPartFromFunctionResponse()
        |
        v
Result is appended to Gemini conversation
        |
        v
Gemini chooses next action
```

## 10. `finishTestTool`

### File

```text
src/llm/finishTestTool.ts
```

### LLM usage

It does not call Gemini directly. It defines a function schema that Gemini can call.

The tool is named:

```text
finishTest
```

Gemini must return:

```ts
{
  status: "pass" | "fail",
  reasoning: string,
  evidenceSteps: number[]
}
```

The execution loop converts this into a `ScenarioVerdict`.

Example failure:

```ts
{
  scenario: "AC2-S1",
  status: "fail",
  reasoning: "The page title still displays Products instead of Inventory.",
  turnsUsed: 5
}
```

## 11. `geminiClient.ts`

### Responsibility

Central Gemini API wrapper.

### Functions

#### `getGeminiClient()`

Returns the singleton Gemini client.

Returns:

```ts
GoogleGenAI
```

Used by the live multi-turn execution loop.

#### `generateText()`

Used by the planner and generator agents.

Returns:

```ts
Promise<string>
```

It retries temporary `503` errors up to three attempts.

#### `generateJSON()`

Calls `generateText()`, removes Markdown code fences, and parses the result as JSON.

Returns:

```ts
Promise<T>
```

It is available as a helper but is not the main path used by the current planner or generator.

## 12. Evidence Flow

### Static Playwright evidence

Created by `npm test`:

```text
evidence/report.md
playwright-report/
allure-report/
test-results/
```

### Live execution evidence

Created by `executionAgent`:

```text
evidence/execution_log.txt
evidence/execution-report.md
evidence/screenshots/
```

The two report types are intentionally separate:

- `report.md` proves the deterministic regression suite result.
- `execution-report.md` proves the live Gemini-driven execution result.

## 13. Complete Story for a Lead

A developer creates a GitHub issue saying:

> Rename the Products header to Inventory.

The issue is labeled `RFQA`.

First, `gitReaderAgent` acts as the intake coordinator. It reads the issue through GitHub MCP, verifies that the issue is ready for QA, extracts the acceptance criteria, and writes `plan.md`. It does not use an LLM because the task is deterministic.

Next, `testPlannerAgent` reads `plan.md` and sends it to Gemini using `generateText()`. Gemini acts as a test analyst. It converts each acceptance criterion into a scenario with preconditions, user actions, expected results, and a link back to the acceptance criterion. The response is returned as a Markdown string and saved to `SCENARIOS.md`.

Then, `testGeneratorAgent` sends the plan, scenarios, and existing Page Objects to Gemini. Gemini acts as a test automation developer. It returns Playwright Page Objects and test specifications using `// FILE:` markers. The generator parses those markers, writes the files to `tests/pages` and `tests/specs`, and runs Playwright.

If Playwright fails, the generator sends the failure output and generated files back to Gemini. Gemini acts as a debugging assistant. It decides whether the problem is a locator, timing, precondition, or real application mismatch. It is instructed not to change a correct assertion simply to make the test pass.

Separately, `executionAgent` reads the same `SCENARIOS.md`. `scenarioParser.ts` converts the Markdown into structured `Scenario` objects. The execution agent starts Playwright MCP and gives Gemini the scenario and browser tools.

Gemini now acts as a live QA engineer. It requests a browser snapshot, sees the accessibility tree, chooses a click or typing action, and receives the browser result. The result is added back into the Gemini conversation. Gemini then chooses the next action. This continues until Gemini calls `finishTest`.

`finishTest` forces Gemini to provide a structured pass or fail status, reasoning, and evidence step numbers. The execution loop returns this as a `ScenarioVerdict`. The evidence logger records every thought, tool call, browser result, screenshot, and verdict.

Finally, `npm test` runs the deterministic Playwright suite, generates Allure and Playwright reports, and builds the evidence folder. The final evidence shows both what the repeatable tests found and what the live autonomous agent observed.

## 14. LLM Usage Summary

| Component | Uses Gemini? | Gemini usage | Return value |
|---|---:|---|---|
| `gitReaderAgent` | No | Deterministic GitHub issue parsing | `RfqaIssue | null` |
| `testPlannerAgent` | Yes | One-shot scenario generation | Markdown `string` |
| `testGeneratorAgent` | Yes | Code generation and one correction attempt | Generated file `string` |
| `scenarioParser` | No | Parses Markdown output | `Scenario[]` |
| `executionAgent` | Indirectly | Coordinates live execution | `void` |
| `executionLoop` | Yes | Multi-turn function calling | `ScenarioVerdict` |
| `finishTestTool` | No direct call | Defines final verdict schema | Function declaration |
| `playwrightMcpClient` | No direct call | Executes browser tools | Tool declarations/results |
| `EvidenceLogger` | No | Writes execution evidence | `void` |

## 15. One-Minute Explanation

> This is an autonomous UI QA pipeline that starts from a GitHub acceptance-criteria issue. A deterministic reader creates `plan.md`. A Gemini planning agent converts the plan into structured scenarios in `SCENARIOS.md`. A second Gemini-powered agent generates Playwright Page Objects and specifications, runs them, and can diagnose one failure iteration. A separate live execution agent uses Gemini's multi-turn tool calling to control a browser through Playwright MCP. The browser results are returned to Gemini after every action, allowing it to decide the next action dynamically. The agent must finish through a structured `finishTest` function, which returns a grounded pass or fail verdict. The project then creates deterministic Playwright reports and live-agent evidence containing logs, screenshots, and verdicts.
