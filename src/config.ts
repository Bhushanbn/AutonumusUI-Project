import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  github: {
    token: required("GITHUB_TOKEN"),
    mcpUrl: process.env.GITHUB_MCP_URL ?? "https://api.githubcopilot.com/mcp/",
    owner: process.env.GITHUB_OWNER ?? "",
    repo: process.env.GITHUB_REPO ?? "",
    projectNumber: process.env.GITHUB_PROJECT_NUMBER
      ? Number(process.env.GITHUB_PROJECT_NUMBER)
      : undefined,
    rfqaStatusValue: process.env.GITHUB_RFQA_STATUS ?? "Ready for QA",
  },
  app: {
    baseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  },
};
