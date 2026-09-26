import { writeFileSync } from "node:fs";
import { config } from "../config.js";
import { getIssue, listRfqaIssues, closeGithubClient } from "../mcp/githubClient.js";
import type { RfqaIssue } from "../types.js";

/**
 * Deterministic, zero-LLM extraction — matches the behavior the Claude Code
 * gitReaderAgent.md subagent used to perform. There is nothing here that
 * needs an LLM: fetching an issue and reformatting its own markdown is a
 * parsing problem, not a reasoning one. This is why swapping the LLM
 * provider for the rest of the pipeline doesn't touch this stage at all.
 */

// Extracts the first section of the issue body that matches any of the given
function extractSection(body: string, headerNames: string[]): string | null {
  for (const name of headerNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Match a Markdown heading (##, ###, etc.) followed by the section name, and capture everything until the next heading or end of string.
    const pattern = new RegExp(`##\\s*${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`);
    const match = body.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// Extracts acceptance criteria from the issue body, supporting various formats and bullet points.
function extractAcceptanceCriteria(body: string): string[] {
  // Find "Acceptance Criteria" anywhere in the issue body.
  // Supports:
  // Acceptance Criteria
  // Acceptance Criteria:
  // ## Acceptance Criteria
  // **Acceptance Criteria**
  // **Acceptance Criteria:**
  const headerMatch = body.match(/Acceptance\s+Criteria\s*:?\s*/i);

  if (!headerMatch || headerMatch.index === undefined) {
    throw new Error(
      'No "Acceptance Criteria" section found in the issue body.',
    );
  }

  // Everything after "Acceptance Criteria"
  const startIndex = headerMatch.index + headerMatch[0].length;
  const remaining = body.slice(startIndex);

  // Stop when another section starts.
  // Supports Markdown headings and common issue sections.
  const nextSectionMatch = remaining.match(
    /\n\s*#{1,6}\s+[^\n]+|\n\s*(?:User Story|Notes|Notes \/ Constraints|Notes for QA)\s*:?\s*(?:\n|$)/i,
  );

  const section = nextSectionMatch
    ? remaining.slice(0, nextSectionMatch.index)
    : remaining;

  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const criteria: string[] = [];

  for (const line of lines) {
    // AC1 - text
    // AC1: text
    // AC1 : text
    // - AC1 - text
    // - AC1: text
    // * AC1 - text
    const acLine = line.match(
      /^[-*]?\s*AC\d+\s*(?:-|:)\s*(.+)$/i,
    );

    if (acLine?.[1]) {
      criteria.push(acLine[1].trim());
      continue;
    }

    // - text
    // * text
    // 1. text
    // 1) text
    const pointLine = line.match(
      /^(?:[-*]\s+|\d+[.)]\s+)(.+)$/,
    );

    if (pointLine?.[1]) {
      criteria.push(pointLine[1].trim());
      continue;
    }

    // Plain acceptance criterion
    // Example:
    // User should see Inventory
    if (
      line &&
      !/^Acceptance\s+Criteria\s*:?\s*$/i.test(line)
    ) {
      criteria.push(line);
    }
  }

  if (criteria.length === 0) {
    throw new Error(
      '"Acceptance Criteria" was found, but no acceptance criteria points were found.',
    );
  }

  return criteria;
}

// Renders the plan.md file content based on the issue and extracted sections.
function renderPlanMarkdown(issue: RfqaIssue, criteria: string[], userStory: string, notes: string): string {
  const numbered = criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return `# Plan: ${issue.title} (#${issue.number})

- Source: ${issue.url}
- QA Status: ${issue.status}
- Ingested: ${new Date().toISOString().slice(0, 10)}

## User Story
${userStory}

## Acceptance Criteria
${numbered}

## Notes / Constraints
${notes}
`;
}

/**
 * The single gate for the whole pipeline: nothing downstream (testPlannerAgent,
 * testGeneratorAgent) re-checks RFQA status — they just trust that if plan.md
 * exists, it was written legitimately. That makes this the ONLY enforcement
 * point, which is why it's checked explicitly here rather than assumed from
 * however the issue was resolved (label-filtered list vs. direct-by-number
 * fetch use different code paths in resolveIssue() below — this check
 * applies to both, uniformly, rather than trusting one path's filtering).
 */
// Returns true if the issue's status matches the configured RFQA status value
function isReadyForQA(issue: RfqaIssue): boolean {
  return (
    issue.status === config.github.rfqaStatusValue ||
    issue.status?.toUpperCase() === "RFQA"
  );
}

// Resolves the RFQA issue to process, either by fetching a specific issue
// number (if GITHUB_ISSUE_NUMBER is set) or by listing open issues and
// filtering for the first one with the RFQA label.
async function resolveIssue(): Promise<RfqaIssue | null> {
  const explicitIssueNumber = process.env.GITHUB_ISSUE_NUMBER
    ? Number(process.env.GITHUB_ISSUE_NUMBER)
    : undefined;
// If an explicit issue number is provided, fetch that issue directly.
  if (explicitIssueNumber) {
    if (!config.github.owner || !config.github.repo) {
      throw new Error("GITHUB_OWNER and GITHUB_REPO must be set to fetch a specific issue.");
    }
    return getIssue(config.github.owner, config.github.repo, explicitIssueNumber);
  }
// Otherwise, list open issues and find the first one with the RFQA label.
  if (!config.github.owner || !config.github.repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO are required (no issue number given to fetch directly).");
  }
  const rfqaIssues = await listRfqaIssues(config.github.owner, config.github.repo);
  return rfqaIssues[0] ?? null;
}

//Checks for an RFQA issue, extracts relevant sections, and writes plan.md if applicable.
export async function runGitReaderAgent(): Promise<RfqaIssue | null> {
  console.log(`Checking ${config.github.owner}/${config.github.repo} for an RFQA issue...`);
  const issue = await resolveIssue();

  if (!issue) {
    console.log("No RFQA issue found (checked open issues for an RFQA/Ready for QA label). Nothing to do.");
    return null;
  }
// If the issue is not in RFQA status, log and exit without writing plan.md.
  if (!isReadyForQA(issue)) {
    console.log(`Issue #${issue.number} is not RFQA yet (status: "${issue.status}"). Nothing written.`,);
    return null;
  }

  console.log(`Found issue #${issue.number}: "${issue.title}". Extracting Acceptance Criteria...`);
  const userStory = extractSection(issue.body, ["User Story"]) ?? "(not specified in issue body)";
  const criteria = extractAcceptanceCriteria(issue.body);
  const notes = extractSection(issue.body, ["Notes / Constraints", "Notes for QA", "Notes"])
    ?? "None explicitly stated in the issue.";

    // combines the section ,Write plan.md with the extracted sections and acceptance criteria.
  writeFileSync("plan.md", renderPlanMarkdown(issue, criteria, userStory, notes));
  console.log(`Wrote plan.md with ${criteria.length} acceptance criteria.`);
  return issue;
}

// The entry point for the gitReaderAgent script: runs the main logic and handles cleanup and error reporting.
async function main() {
  try {
    const result = await runGitReaderAgent();
    process.exit(result ? 0 : 1);
  } finally {
    await closeGithubClient();
  }
}

main().catch((err) => {
  console.error("gitReaderAgent failed:", err.message ?? err);
  process.exit(1);
});