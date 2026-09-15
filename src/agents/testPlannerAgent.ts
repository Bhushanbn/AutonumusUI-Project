import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generateText } from "../llm/geminiClient.js";


// Instruction for Gemini, guiding it to generate structured test scenarios from the Acceptance Criteria in plan.md.
const SYSTEM_INSTRUCTION = `You are testPlannerAgent. You take Acceptance Criteria from a plan.md file and map each one into explicit, executable functional test scenarios. You do not write code and you do not touch the browser.

For every Acceptance Criteria item, derive one or more scenarios. Each scenario must be concrete enough that a test-generation stage can write a Playwright spec from it without asking clarifying questions. Include negative/edge scenarios only when the criterion implies them (e.g. validation, error states) — do not pad with speculative scenarios unrelated to the criteria.

For each scenario, capture:
- ID: ACn-Sm (n = acceptance criteria number from plan.md, m = scenario index within that criterion)
- Title: short imperative description
- Preconditions: required starting state
- User Actions: numbered, sequential steps described in terms of visible UI/roles/labels/text, NOT CSS/XPath selectors
- Expected Validation Checkpoints: numbered, verifiable outcomes tied directly back to the acceptance criterion text
- Linked Acceptance Criteria: the exact criterion text or number it validates

Output ONLY markdown in exactly this structure, no preamble, no code fences around the whole thing:

# Test Scenarios (source: plan.md — <Issue Title> #<n>)

## AC1: <criterion text>
### AC1-S1: <scenario title>
- Preconditions:
  - ...
- User Actions:
  1. ...
- Expected Validation Checkpoints:
  1. ...
- Linked Acceptance Criteria: AC1 — "<criterion text>"

### AC1-S2: <scenario title> (if applicable)
...

## AC2: <criterion text>
...

Rules:
- Every acceptance criterion must map to at least one scenario — no silent omissions. If a criterion is untestable via UI, still list it with a note explaining why and mark it "manual/non-UI".
- Do not reference specific CSS selectors, XPath, or test IDs — describe elements by role/label/visible text.`;

// The main function that orchestrates the testPlannerAgent's operations: reads plan.md, generates scenarios via Gemini, and writes SCENARIOS.md.
export async function runTestPlannerAgent(): Promise<void> {
  if (!existsSync("plan.md")) {
    throw new Error("plan.md not found — run gitReaderAgent first.");
  }
  const planContent = readFileSync("plan.md", "utf-8");
  if (!/##\s*Acceptance Criteria/i.test(planContent)) {
    throw new Error('plan.md has no "## Acceptance Criteria" section — run gitReaderAgent first.');
  }

  console.log("Generating test scenarios from plan.md via Gemini...");
  const scenarios = await generateText({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: planContent,
  });

  writeFileSync("SCENARIOS.md", scenarios.trim() + "\n");
  const scenarioCount = (scenarios.match(/^### AC\d+-S\d+:/gm) ?? []).length;
  console.log(`Wrote SCENARIOS.md with ${scenarioCount} scenario(s).`);
}

// The entry point for the testPlannerAgent script: runs the main logic and handles error reporting.
runTestPlannerAgent().catch((err) => {
  console.error("testPlannerAgent failed:", err.message ?? err);
  process.exit(1);
});