import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { topStories } from "./tools.ts";

const APP = "hacker-news-mcp";

// Create server instance
const server = new McpServer({
  name: APP,
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(...topStories);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${APP} MCP Server running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
