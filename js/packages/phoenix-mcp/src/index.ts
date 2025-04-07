#!/usr/bin/env node
/* eslint-disable no-console */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@arizeai/phoenix-client";
import minimist from "minimist";
import { initializeDatasetTools } from "./datasetTools.js";
import { initializeExperimentTools } from "./experimentTools.js";
import { initializePromptTools } from "./promptTools.js";
import { initializeReadmeResources } from "./readmeResource.js";
import { initializePrompts } from "./prompts.js";
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
    prompts: {},
  },
});

initializePrompts({ client, server });
initializePromptTools({ client, server });
initializeExperimentTools({ client, server });
initializeDatasetTools({ client, server });

async function main() {
  // Initialize readme resources first
  if (process.env.DANGEROUSLY_READ_README_FILES === "true") {
    await initializeReadmeResources({ server });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Phoenix MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
