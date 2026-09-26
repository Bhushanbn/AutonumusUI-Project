import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  FunctionCallingConfigMode,
  createUserContent,
  createPartFromFunctionResponse,
  type Content,
} from "@google/genai";
import { getGeminiClient } from "../llm/geminiClient.js";
import { getPlaywrightToolDeclarations, callPlaywrightTool } from "../mcp/playwrightMcpClient.js";
import { finishTestDeclaration, type FinishTestArgs } from "../llm/finishTestTool.js";
import { config } from "../config.js";
import type { EvidenceLogger } from "./evidenceRecorder.js";

// Keep the execution loop independent from the scenario parser module. The
// loop only needs the normalized scenario shape, so defining it here also
// avoids a runtime/module-resolution dependency on the parser implementation.
export interface Scenario {
  id: string;
  title: string;
  preconditions: string;
  userActions: string[];
  checkpoints: string[];
  linkedAc: string;
}

export interface ScenarioVerdict {
  scenario: string;
  status: "pass" | "fail";
  reasoning: string;
  turnsUsed: number;
  abortedReason?: string;
}

const SYSTEM_INSTRUCTION = `You are an autonomous UI test execution agent. You test a live web page by calling Playwright MCP tools (browser_navigate, browser_snapshot, browser_click, browser_type, browser_take_screenshot, browser_press_key, browser_wait_for, etc). You cannot see raw HTML, CSS, or XPath — elements are identified only by what browser_snapshot's accessibility tree shows you (role, accessible name, a ref id). Act on refs from your MOST RECENT snapshot only; take a fresh snapshot after any action that may have changed the page.

Hard rules:
1. You have a limited number of tool calls for this scenario. Work efficiently.
2. You MUST call finishTest exactly once, as your final action.
3. You may only report status "pass" if a browser_snapshot you actually took confirms the specific Acceptance Criterion checkpoint. Never report pass from assumption or because earlier steps "should have worked."
4. If an expected element isn't found after 2-3 reasonable attempts (including one alternate-name guess), treat that as evidence toward "fail" rather than searching indefinitely.
5. If you are about to repeat the exact same tool call with the exact same arguments a third time, stop — call finishTest with "fail" and explain what didn't respond as expected.
6. Before each tool call, state in one sentence what you're doing and why, so the log is auditable.
7. Only interact with elements present in your most recent snapshot.`;

const MAX_TURNS_PER_SCENARIO = 20;

function buildScenarioPrompt(scenario: Scenario, targetUrl: string): string {
  return `Target application base URL: ${targetUrl}

Scenario: ${scenario.id} — ${scenario.title}
Preconditions: ${scenario.preconditions}
User Actions:
${scenario.userActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}
Expected Validation Checkpoints:
${scenario.checkpoints.map((c, i) => `${i + 1}. ${c}`).join("\n")}
Linked Acceptance Criterion: ${scenario.linkedAc}

Start by navigating to the target URL (or taking a snapshot first if you have reason to believe you're already on the right page).`;
}

// Creates a Content object representing the scenario prompt for the model.
export async function runScenario(
  mcp: Client,
  scenario: Scenario,
  logger: EvidenceLogger,
): Promise<ScenarioVerdict> {
  const genAI = getGeminiClient();
  const mcpDeclarations = await getPlaywrightToolDeclarations(mcp);

  // The execution loop maintains a conversation with the model, sending it the scenario prompt and any subsequent tool call results, and receiving its next action or verdict. It enforces turn limits and guards against repeated identical actions.
  const contents: Content[] = [createUserContent(buildScenarioPrompt(scenario, config.app.baseUrl))];

  let lastCallSignature = "";
  let repeatCount = 0;

  for (let turn = 1; turn <= MAX_TURNS_PER_SCENARIO; turn++) {
    const response = await genAI.models.generateContent({
      model: config.gemini.model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [...mcpDeclarations, finishTestDeclaration] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
        // Manual control, deliberately: automatic function calling would run
        // the whole loop inside the SDK, hiding exactly the per-step
        // reasoning/screenshot/guardrail behavior this agent exists to produce.
        automaticFunctionCalling: { disable: true },
        temperature: 0.1,
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const thought = response.text?.trim();
    if (thought) logger.logThought(scenario.id, turn, thought);

    const call = response.functionCalls?.[0];
    if (!call || !call.name) {
      logger.logAbort(scenario.id, turn, "Model returned no function call.");
      contents.push(createUserContent("You must call a tool. If you're done, call finishTest."));
      continue;
    }

    logger.logToolCall(scenario.id, turn, call.name, call.args ?? {});

    // Guardrail: identical action 3x in a row -> abort rather than let it spin.
    const signature = `${call.name}:${JSON.stringify(call.args)}`;
    repeatCount = signature === lastCallSignature ? repeatCount + 1 : 0;
    lastCallSignature = signature;
    if (repeatCount >= 2) {
      const abortedReason = `Stuck: identical action "${call.name}" repeated 3 times in a row.`;
      logger.logAbort(scenario.id, turn, abortedReason);
      return { scenario: scenario.id, status: "fail", reasoning: abortedReason, turnsUsed: turn, abortedReason };
    }

    if (call.name === "finishTest") {
      const args = call.args as unknown as FinishTestArgs;
      logger.logVerdict(scenario.id, turn, args);
      return { scenario: scenario.id, status: args.status, reasoning: args.reasoning, turnsUsed: turn };
    }

    const { resultForModel, screenshotBase64 } = await callPlaywrightTool(
      mcp,
      call.name,
      (call.args ?? {}) as Record<string, unknown>,
    );
    logger.logToolResult(scenario.id, turn, resultForModel);
    if (screenshotBase64) {
      logger.saveScreenshot(scenario.id, turn, screenshotBase64);
    } else {
      // Force a screenshot after every action regardless of whether the
      // model chose to take one — evidence completeness matters more than
      // trusting the model to remember, same principle as testGeneratorAgent
      // not being trusted to weaken its own assertions unsupervised.
      try {
        const forced = await callPlaywrightTool(mcp, "browser_take_screenshot", {});
        if (forced.screenshotBase64) logger.saveScreenshot(scenario.id, turn, forced.screenshotBase64);
      } catch {
        // best-effort; some MCP tool calls (e.g. a failed click) may leave
        // the page in a state where a screenshot attempt itself errors —
        // don't let that mask the original tool result.
      }
    }

    contents.push(
      createUserContent([
        createPartFromFunctionResponse(call.id ?? call.name, call.name, resultForModel),
      ]),
    );
  }

  const abortedReason = `Exceeded max turns (${MAX_TURNS_PER_SCENARIO}) without reaching a verdict.`;
  logger.logAbort(scenario.id, MAX_TURNS_PER_SCENARIO, abortedReason);
  return {
    scenario: scenario.id,
    status: "fail",
    reasoning: abortedReason,
    turnsUsed: MAX_TURNS_PER_SCENARIO,
    abortedReason,
  };
}