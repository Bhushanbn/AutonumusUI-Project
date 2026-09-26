import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { FunctionDeclaration } from "@google/genai";

/**
 * Wraps @playwright/mcp for use as the browser-execution tool in the live
 * executionAgent (Stage 4). This is a plain wrapper around the standard
 * MCP client SDK — no framework-specific magic. @google/genai does ship an
 * experimental `mcpToTool()` helper that does something similar
 * automatically, but it's explicitly marked `@experimental` in Google's own
 * type definitions, so this file does the conversion by hand instead: one
 * fewer moving part to debug if something's off, and every step here is
 * something you can trace yourself.
 */

let client: Client | undefined;
let transport: StdioClientTransport | undefined;

// Connects to the Playwright MCP server (spawns it if needed) and returns a ready-to-use Client instance.
// Playwright MCP Client provides browser-control tools to the execution loop.

export async function connectPlaywrightMcp(): Promise<Client> {
  if (client) return client;

  transport = new StdioClientTransport({
    command: "npx",
    args: ["@playwright/mcp@latest", "--headless"],
  });
  client = new Client({ name: "execution-agent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

// Disconnects from the Playwright MCP server and cleans up resources.
export async function disconnectPlaywrightMcp(): Promise<void> {
  await client?.close();
  client = undefined;
  transport = undefined;
}

// Retrieves the list of available Playwright MCP tools and converts them into FunctionDeclaration objects for use with the Gemini model.
export async function getPlaywrightToolDeclarations(mcp: Client): Promise<FunctionDeclaration[]> {
  const { tools } = await mcp.listTools();
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    parametersJsonSchema: tool.inputSchema,
  }));
}

// Calls a Playwright MCP tool with the given name and arguments, returning the result formatted for the model along with an optional screenshot in base64 format.
export async function callPlaywrightTool(
  mcp: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ resultForModel: Record<string, unknown>; screenshotBase64?: string | undefined }> {
  const result = await mcp.callTool({ name, arguments: args });
  const content = (result.content as Array<{ type: string; text?: string; data?: string }>) ?? [];

  const textParts = content.filter((c) => c.type === "text").map((c) => c.text ?? "");
  const imagePart = content.find((c) => c.type === "image");

  return {
    resultForModel: {
      isError: Boolean(result.isError),
      text: textParts.join("\n").slice(0, 4000),
    },
    screenshotBase64: imagePart?.data,
  };
}