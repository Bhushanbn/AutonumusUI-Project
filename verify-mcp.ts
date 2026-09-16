import {
  connectPlaywrightMcp,
  getPlaywrightToolDeclarations,
  disconnectPlaywrightMcp,
} from "./src/mcp/playwrightMcpClient.js";


// Connect to the Playwright MCP server, retrieve the list of tools, and log their names.
const mcp = await connectPlaywrightMcp();

const decls = await getPlaywrightToolDeclarations(mcp);

console.log("Playwright MCP tools:");
console.log(decls.map((d) => d.name));

await disconnectPlaywrightMcp();