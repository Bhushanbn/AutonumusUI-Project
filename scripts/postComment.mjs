import { readFileSync, existsSync } from "node:fs";

/**
 * Replaces what Claude Code used to do as part of its own `claude -p`
 * prompt ("post a PASS/FAIL summary as a comment"). This is a one-shot
 * REST call — no LLM, no MCP tool schema to guess at — so it doesn't need
 * to change regardless of which LLM the planner/generator stages use.
 */

const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const issueNumber = process.env.ISSUE_NUMBER ?? process.env.GITHUB_ISSUE_NUMBER;
const token = process.env.GITHUB_TOKEN;

// Validates that all required environment variables for posting a comment are present. If any are missing, logs an error and exits the process without failing the CI run.
if (!owner || !repo || !issueNumber || !token) {
  console.error(
    "postComment: missing one of GITHUB_OWNER/GITHUB_REPO/ISSUE_NUMBER/GITHUB_TOKEN — skipping comment.",
  );
  process.exit(0); // don't fail the whole CI run just because the comment step can't run
}

// Builds a summary of the test results from the evidence/report.md file, including a link to the full run and artifacts if available. If the report.md file is missing, it returns a warning message.
function buildSummary() {
  const reportPath = "evidence/report.md";
  if (!existsSync(reportPath)) {
    return "⚠️ Autonomous QA pipeline ran, but evidence/report.md was not found — check the workflow logs and uploaded artifacts.";
  }
  const report = readFileSync(reportPath, "utf-8");
  const resultLine = report.match(/\*\*Result:.+\*\*/)?.[0] ?? "Result line not found in report.md";
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

  return [
    "## 🤖 Autonomous QA Pipeline Result",
    "",
    resultLine,
    "",
    runUrl ? `Full run + artifacts (Playwright/Allure reports, screenshots, traces): ${runUrl}` : "",
  ].join("\n");
}

// Posts the PASS/FAIL summary comment to the specified GitHub issue using the GitHub REST API. If the request fails, logs an error and exits the process with a failure code.
async function main() {
  const body = buildSummary();
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    },
  );

  if (!res.ok) {
    console.error(`Failed to post comment: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Posted PASS/FAIL summary comment on ${owner}/${repo}#${issueNumber}.`);
}

main();