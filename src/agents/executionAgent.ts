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
  const scenarios = parseScenarios(readFileSync("SCENARIOS.md", "utf-8"));
  console.log(`Loaded ${scenarios.length} scenario(s) from SCENARIOS.md.`);

  const logger = new EvidenceLogger();
  const mcp = await connectPlaywrightMcp();

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