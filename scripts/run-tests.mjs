import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isWin = process.platform === "win32";

// Only npm-installed CLI tools get a .cmd shim on Windows — "node" itself
// is a real executable (node.exe), never node.cmd, so it must never get
// the suffix appended or Windows can't find it.
function run(cmd, cmdArgs) {
  const resolvedCmd = isWin && cmd !== "node" ? `${cmd}.cmd` : cmd;
  const result = spawnSync(resolvedCmd, cmdArgs, {
    stdio: "inherit",
    shell: isWin,
  });
  return result.status ?? 1;
}

const testExitCode = run("playwright", ["test", ...args]);
const reportExitCode = run("allure", ["generate", "allure-results", "--clean", "-o", "allure-report"]);

if (reportExitCode !== 0) {
  console.error("Allure report generation failed.");
}

const evidenceExitCode = run("node", ["scripts/buildEvidence.mjs"]);
if (evidenceExitCode !== 0) {
  console.error("evidence/ population failed — check test-results/results.json exists.");
}

process.exit(testExitCode);