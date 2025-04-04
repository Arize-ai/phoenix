/* eslint-disable no-console */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@arizeai/phoenix-client";
import minimist from "minimist";
import {
  initializeDatasetTools,
  initializeExperimentTools,
  initializePromptTools,
} from "./tools";
import { initializeReadmeResources } from "./resources";

const argv = minimist(process.argv.slice(2));

// Initialize Phoenix client
const client = createClient({
  options: {
    baseUrl: argv.baseUrl || "http://localhost:6006",
    headers: {
      Authorization: `Bearer ${argv.apiKey}`,
      api_key: argv.apiKey, // For hosted phoenix
    },
  },
});

// Create server instance
const server = new McpServer({
  name: "phoenix-mcp-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

initializePromptTools({ client, server });
initializeExperimentTools({ client, server });
initializeDatasetTools({ client, server });

async function main() {
  // Initialize readme resources first
  await initializeReadmeResources({ server });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Phoenix MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
