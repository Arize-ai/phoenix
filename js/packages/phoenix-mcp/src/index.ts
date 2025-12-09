#!/usr/bin/env node
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";

import { initializeDatasetTools } from "./datasetTools.js";
import { initializeExperimentTools } from "./experimentTools.js";
import { initializeProjectTools } from "./projectTools.js";
import { initializePromptTools } from "./promptTools.js";
import { initializeReadmeResources } from "./readmeResource.js";
import { initializeSpanTools } from "./spanTools.js";
import { initializeSupportTools } from "./supportTools.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import minimist from "minimist";

const argv = minimist(process.argv.slice(2));

const headers = argv.apiKey
  ? {
      Authorization: `Bearer ${argv.apiKey}`,
      api_key: argv.apiKey, // For hosted phoenix
    }
  : {};

// Initialize Phoenix client
const client = createClient({
  options: {
    baseUrl: argv.baseUrl || "http://localhost:6006",
    headers,
  },
});

// Create server instance
const server = new McpServer({
  name: "phoenix-mcp-server",
  version: "1.0.0",
});

initializePromptTools({ client, server });
initializeExperimentTools({ client, server });
initializeDatasetTools({ client, server });
initializeProjectTools({ client, server });
initializeSpanTools({ client, server });
initializeSupportTools({ server });

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
