import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isWin = process.platform === "win32";

function run(cmd, cmdArgs) {
  const result = spawnSync(isWin ? `${cmd}.cmd` : cmd, cmdArgs, {
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

process.exit(testExitCode);
