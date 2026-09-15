import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateText } from "../llm/geminiClient.js";
import { config } from "../config.js";

// The maximum number of iterations to attempt fixing failing tests before giving up and reporting a failure.
const MAX_FIX_ITERATIONS = 2;

// Instruction for Gemini, guiding it to generate runnable Playwright + TypeScript tests from the test scenarios in SCENARIOS.md.
const SYSTEM_INSTRUCTION = `You are testGeneratorAgent, the execution-authoring stage of an autonomous QA pipeline. You turn test scenarios into real, runnable Playwright + TypeScript tests using the Page Object Model.

Output layout:
- tests/pages/<Feature>Page.ts — one Page Object class per distinct page/screen. Locators as class fields using role/label/text-based locators (getByRole, getByLabel, getByText, getByTestId only if the app already exposes stable test ids) — avoid brittle CSS/XPath selectors. Action methods and query/assertion-support methods only — no raw locator logic in spec files.
- tests/specs/<feature>.spec.ts — one spec file per acceptance-criteria group. One test() per scenario, titled with its scenario ID, e.g. test('AC1-S1: <title>', ...). Arrange preconditions, act through Page Object methods only, then assert every Expected Validation Checkpoint with an explicit expect(). Use test.step() per user action/checkpoint. Prefer web-first assertions (expect(locator).toBeVisible()) over manual waits.

Conventions: TypeScript, @playwright/test conventions, baseURL is already configured in playwright.config.ts so use relative paths in page.goto() calls (e.g. "/", not the full domain). Do not duplicate a Page Object if an equivalent one is shown to you as already existing — extend/reuse it instead by regenerating its full file with additions.

Respond with ONLY the file contents for each file you create or modify, each preceded by its own line in exactly this form (no other text before/after):
// FILE: tests/pages/Example.ts
<full file content>
// FILE: tests/specs/example.spec.ts
<full file content>

No prose, no explanation, no markdown code fences — just the // FILE: markers and raw file contents.`;

interface GeneratedFile {
  path: string;
  content: string;
}

// Parses Gemini's output into an array of GeneratedFile objects, each with a path and content.
function parseGeneratedFiles(text: string): GeneratedFile[] {
  const blocks = text.split(/^\/\/ FILE:\s*(.+)$/m).slice(1);
  const files: GeneratedFile[] = [];
  for (let i = 0; i < blocks.length; i += 2) {
    const path = blocks[i]?.trim();
    const content = blocks[i + 1]?.replace(/^\n/, "").replace(/```[a-z]*\n?/g, "") ?? "";
    if (path && content.trim()) files.push({ path, content });
  }
  if (files.length === 0) {
    throw new Error(`Could not parse any "// FILE:" blocks from Gemini's output:\n\n${text.slice(0, 2000)}`);
  }
  return files;
}

// Writes the generated files to disk, creating directories as needed and ensuring a trailing newline.
function writeGeneratedFiles(files: GeneratedFile[]): void {
  for (const file of files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content.trimEnd() + "\n");
    console.log(`  wrote ${file.path}`);
  }
}

// Reads existing Page Object files from tests/pages/ and returns their contents as a single string for Gemini's reuse.
function readExistingPageObjects(): string {
  const dir = "tests/pages";
  if (!existsSync(dir)) return "(none yet)";
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  if (files.length === 0) return "(none yet)";
  return files
    .map((f) => `--- ${join(dir, f)} ---\n${readFileSync(join(dir, f), "utf-8")}`)
    .join("\n\n");
}

// Runs Playwright tests for the given spec file paths and returns whether they passed along with the combined output.
function runPlaywright(specPaths: string[]): { passed: boolean; output: string } {
  const result = spawnSync(
    "npx",
    ["playwright", "test", ...specPaths, "--reporter=line"],
    { encoding: "utf-8" },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { passed: result.status === 0, output };
}

// The main function that orchestrates the testGeneratorAgent's operations: reads SCENARIOS.md, generates Page Objects and spec files via Gemini, runs Playwright, and attempts fixes if tests fail.
export async function runTestGeneratorAgent(): Promise<void> {
  if (!existsSync("SCENARIOS.md")) {
    throw new Error("SCENARIOS.md not found — run testPlannerAgent first.");
  }
  const scenarios = readFileSync("SCENARIOS.md", "utf-8");
  const plan = existsSync("plan.md") ? readFileSync("plan.md", "utf-8") : "";
  const existingPages = readExistingPageObjects();

  const basePrompt = `Target application base URL: ${config.app.baseUrl}

## plan.md (acceptance criteria wording — pass/fail must reflect this)
${plan}

## SCENARIOS.md (generate tests for every scenario in here)
${scenarios}

## Existing Page Objects (reuse/extend, do not duplicate)
${existingPages}`;

  console.log("Generating Page Objects + spec files via Gemini...");
  let raw = await generateText({ systemInstruction: SYSTEM_INSTRUCTION, prompt: basePrompt });
  let files = parseGeneratedFiles(raw);
  writeGeneratedFiles(files);

  const specPaths = files.filter((f) => f.path.includes("tests/specs/")).map((f) => f.path);
  if (specPaths.length === 0) {
    throw new Error("Gemini's output didn't include any tests/specs/*.spec.ts file.");
  }

  for (let attempt = 0; attempt <= MAX_FIX_ITERATIONS; attempt++) {
    console.log(`Running Playwright (attempt ${attempt + 1}/${MAX_FIX_ITERATIONS + 1})...`);
    const { passed, output } = runPlaywright(specPaths);
    console.log(output);

    if (passed) {
      console.log("All generated tests passed.");
      return;
    }

    if (attempt === MAX_FIX_ITERATIONS) {
      console.error(
        `Tests still failing after ${MAX_FIX_ITERATIONS} fix attempt(s). Stopping — this may be a ` +
          `genuine functional failure against the Acceptance Criteria, not a script bug. See output above ` +
          `and the Playwright/Allure reports for details.`,
      );
      process.exitCode = 1;
      return;
    }

    console.log("Failure detected — asking Gemini to diagnose and fix (not to weaken assertions)...");
    const fixPrompt = `${basePrompt}

## Previous attempt's generated files
${files.map((f) => `// FILE: ${f.path}\n${f.content}`).join("\n")}

## Playwright run output (this attempt failed)
${output.slice(0, 6000)}

Diagnose the failure: is this a locator problem, a timing/race issue, or a wrong precondition in the generated test — or does it look like a genuine mismatch between the app's real behavior and an Expected Validation Checkpoint (in which case, do NOT change the assertion just to force a pass; leave it as a real failure and make sure the test's error message is clear about what checkpoint failed)? Regenerate the full corrected file(s) using the same "// FILE:" format. Only include files that actually need to change.`;

    raw = await generateText({ systemInstruction: SYSTEM_INSTRUCTION, prompt: fixPrompt });
    const fixedFiles = parseGeneratedFiles(raw);
    writeGeneratedFiles(fixedFiles);
    for (const f of fixedFiles) {
      const idx = files.findIndex((existing) => existing.path === f.path);
      if (idx >= 0) files[idx] = f;
      else files.push(f);
    }
  }
}

runTestGeneratorAgent().catch((err) => {
  console.error("testGeneratorAgent failed:", err.message ?? err);
  process.exit(1);
});