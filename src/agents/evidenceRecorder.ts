import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { FinishTestArgs } from "../llm/finishTestTool.js";
import type { ScenarioVerdict } from "./executionLoop.js";

/**
 * Writes evidence/execution_log.txt and evidence/screenshots/ — the "thought
 * process" trail the brief asks for. Deliberately a SEPARATE file from
 * evidence/report.md (which buildEvidence.mjs builds from the static
 * testGeneratorAgent suite's Playwright JSON output) — this is the live
 * agent's own report, not a replacement for the other one. Both are real
 * evidence of different things: one proves a maintained regression suite
 * passes, the other proves autonomous live execution actually happened.
 */
export class EvidenceLogger {
  private logPath = "evidence/execution_log.txt";
  private screenshotDir = "evidence/screenshots";
  private reportPath = "evidence/execution-report.md";
  private verdicts: ScenarioVerdict[] = [];

  constructor() {
    mkdirSync(this.screenshotDir, { recursive: true });
    writeFileSync(this.logPath, `Execution log — started ${new Date().toISOString()}\n\n`);
  }

  private write(line: string): void {
    appendFileSync(this.logPath, line + "\n");
    console.log(line);
  }

  logThought(scenario: string, turn: number, text: string): void {
    this.write(`[${scenario}] turn ${turn}: ${text}`);
  }

  logToolCall(scenario: string, turn: number, name: string, args: Record<string, unknown>): void {
    this.write(`[${scenario}] turn ${turn}: -> calling ${name}(${JSON.stringify(args)})`);
  }

  logToolResult(scenario: string, turn: number, result: Record<string, unknown>): void {
    const summary = typeof result.text === "string" ? result.text.slice(0, 300) : JSON.stringify(result).slice(0, 300);
    this.write(`[${scenario}] turn ${turn}: <- result: ${summary}${result.isError ? " (ERROR)" : ""}`);
  }

  logAbort(scenario: string, turn: number, reason: string): void {
    this.write(`[${scenario}] turn ${turn}: ABORTED — ${reason}`);
  }

  logVerdict(scenario: string, turn: number, args: FinishTestArgs): void {
    this.write(`[${scenario}] turn ${turn}: VERDICT ${args.status.toUpperCase()} — ${args.reasoning}`);
  }

  saveScreenshot(scenario: string, turn: number, base64: string): void {
    const filename = `${scenario}-step-${String(turn).padStart(2, "0")}.png`;
    writeFileSync(`${this.screenshotDir}/${filename}`, Buffer.from(base64, "base64"));
  }

  recordVerdict(verdict: ScenarioVerdict): void {
    this.verdicts.push(verdict);
  }

  writeFinalReport(): void {
    const passCount = this.verdicts.filter((v) => v.status === "pass").length;
    const lines = [
      "# Live Execution Agent Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      `See execution_log.txt for the full turn-by-turn reasoning trail, and screenshots/ for visual evidence.`,
      "",
      `**Result: ${passCount}/${this.verdicts.length} scenarios passed**`,
      "",
      "| Scenario | Status | Turns Used | Reasoning |",
      "|---|---|---|---|",
      ...this.verdicts.map(
        (v) =>
          `| ${v.scenario} | ${v.status === "pass" ? "✅ PASS" : "❌ FAIL"} | ${v.turnsUsed} | ${v.reasoning.replace(/\|/g, "\\|")} |`,
      ),
    ];
    writeFileSync(this.reportPath, lines.join("\n") + "\n");
  }
}