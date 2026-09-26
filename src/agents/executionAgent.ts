import { readFileSync, existsSync } from "node:fs";
import { connectPlaywrightMcp, disconnectPlaywrightMcp, callPlaywrightTool } from "../mcp/playwrightMcpClient.js";
import { parseScenarios } from "../llm/scenarioParser.js";
import { runScenario } from "./executionLoop.js";
import { EvidenceLogger } from "./evidenceRecorder.js";
import { config } from "../config.js";

// The main entry point for the executionAgent. It reads SCENARIOS.md, connects to the Playwright MCP, and runs each scenario in sequence, logging evidence and verdicts.
async function main() {
  if (!existsSync("SCENARIOS.md")) {
    throw new Error("SCENARIOS.md not found — run agent:plan first.");
  }
  // Load and parse the scenarios from SCENARIOS.md, throwing an error if none are found.
  const scenarios = parseScenarios(readFileSync("SCENARIOS.md", "utf-8"));
  console.log(`Loaded ${scenarios.length} scenario(s) from SCENARIOS.md.`);

  // Initialize the EvidenceLogger to record the execution trail and connect to the Playwright MCP for browser automation.
  const logger = new EvidenceLogger();
  // Connect to the Playwright MCP (Message Control Protocol) to control the browser for executing scenarios.
  const mcp = await connectPlaywrightMcp();

  // Run each scenario in sequence, logging thoughts, tool calls, results, and verdicts. Ensure a fresh browser page for each scenario to avoid state contamination.
  try {
    for (const scenario of scenarios) {
      console.log(`\n▶ Executing ${scenario.id}: ${scenario.title}`);
      // Fresh page per scenario so one scenario's failure doesn't leave the
      // next one starting from an unknown state.
      await callPlaywrightTool(mcp, "browser_navigate", { url: config.app.baseUrl });

      const verdict = await runScenario(mcp, scenario, logger);
      logger.recordVerdict(verdict);
      console.log(`  → ${verdict.status.toUpperCase()} (${verdict.turnsUsed} turns): ${verdict.reasoning}`);
    }
  } finally {
    logger.writeFinalReport();
    await disconnectPlaywrightMcp();
  }

  console.log("\nDone. See evidence/execution-report.md, evidence/execution_log.txt, evidence/screenshots/.");
}

main().catch((err) => {
  console.error("executionAgent failed:", err.message ?? err);
  process.exit(1);
});