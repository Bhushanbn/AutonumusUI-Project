import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import type { RfqaIssue } from "../types.js";

let clientPromise: Promise<Client> | undefined;

/// Lazily creates and returns a GitHub MCP client, reusing the same instance
function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StreamableHTTPClientTransport(
        new URL(config.github.mcpUrl),
        {
          requestInit: {
            headers: { Authorization: `Bearer ${config.github.token}` },
          },
        },
      ) as unknown as Transport;
      const client = new Client({ name: "autonomous-ui-test", version: "1.0.0" });
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

// Calls a GitHub MCP tool by name with the given arguments, returning the parsed JSON result
async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(`GitHub MCP tool "${name}" failed: ${JSON.stringify(result.content)}`);
  }
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text) as T;
}

/**
 * Parses the owner/repo/issue-number triple GitHub encodes in a Projects
 * board URL's `issue` query param, e.g. "Owner|Repo-Name|123".
 */
export function parseIssueUrlParam(issueParam: string): {
  owner: string;
  repo: string;
  number: number;
} {
  const [owner, repo, numberStr] = decodeURIComponent(issueParam).split("|");
  if (!owner || !repo || !numberStr) {
    throw new Error(`Unrecognized GitHub project issue param: ${issueParam}`);
  }
  return { owner, repo, number: Number(numberStr) };
}

/// Tool result types
interface GitHubIssueToolResult {
  title: string;
  html_url: string;
  body: string | null;
  number: number;
  labels?: Array<{ name: string }>;
}

/** Fetches one issue's title/body directly by owner/repo/number, via the issue_read MCP tool. */
export async function getIssue(
  owner: string,
  repo: string,
  number: number,
): Promise<RfqaIssue> {
  const issue = await callTool<GitHubIssueToolResult>("issue_read", {
    method: "get",
    owner,
    repo,
    issue_number: number,
  });
  return {
    owner,
    repo,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    body: issue.body ?? "",
    status: config.github.rfqaStatusValue,
  };
}

interface ListIssuesToolResult {
  issues: GitHubIssueToolResult[];
}

/**
 * Lists open issues in a repo carrying an "RFQA" / "Ready for QA" label.
 *
 * Note: the hosted GitHub MCP server's default toolset does not expose
 * Projects (v2) tools, so Status-field-based detection isn't available here —
 * this relies on the repo using a matching label to mark issues RFQA instead.
 * If you need Project Status field support, run a local github-mcp-server
 * with the "projects" toolset enabled and add project-item tool calls here.
 */
export async function listRfqaIssues(owner: string, repo: string): Promise<RfqaIssue[]> {
  const result = await callTool<ListIssuesToolResult>("list_issues", {
    owner,
    repo,
    state: "open",
  });

  // Filter for issues with an "RFQA" or "Ready for QA" label, and map to RfqaIssue objects
  return result.issues
    .filter((issue) =>
      (issue.labels ?? []).some((l) => {
        // The hosted GitHub MCP server's list_issues tool returns labels as
        // plain strings, not {name: string} objects like GitHub's REST API —
        // handle both shapes rather than assuming one.
        const labelName = typeof l === "string" ? l : l.name;
        return /^(rfqa|ready for qa)$/i.test(labelName ?? "");
      }),
    )
    .map((issue) => ({
      owner,
      repo,
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      body: issue.body ?? "",
      status: config.github.rfqaStatusValue,
    }));
}

/// Closes the GitHub MCP client, if it was created, and resets the cached promise
export async function closeGithubClient(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = undefined;
  }
}
