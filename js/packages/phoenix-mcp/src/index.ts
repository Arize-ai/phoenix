#!/usr/bin/env node
/* eslint-disable no-console */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import minimist from "minimist";

import { initializeAnnotationConfigTools } from "./annotationConfigTools.js";
import { createPhoenixClient } from "./client.js";
import { resolveConfig } from "./config.js";
import { initializeDatasetTools } from "./datasetTools.js";
import { initializeExperimentTools } from "./experimentTools.js";
import { initializeProjectTools } from "./projectTools.js";
import { initializePromptTools } from "./promptTools.js";
import { initializeReadmeResources } from "./readmeResource.js";
import { initializeSessionTools } from "./sessionTools.js";
import { initializeSpanTools } from "./spanTools.js";
import { initializeSupportTools } from "./supportTools.js";
import { initializeTraceTools } from "./traceTools.js";

const argv = minimist(process.argv.slice(2));
const config = resolveConfig({
  commandLineOptions: {
    apiKey: argv.apiKey,
    baseUrl: argv.baseUrl,
    project: argv.project,
  },
});
const client = createPhoenixClient({ config });

// Create server instance
const server = new McpServer({
  name: "phoenix-mcp-server",
  version: "1.1.0",
});

initializePromptTools({ client, server });
initializeExperimentTools({ client, server });
initializeDatasetTools({ client, server });
initializeProjectTools({ client, server });
initializeTraceTools({ client, server, defaultProject: config.project });
initializeSpanTools({ client, server, defaultProject: config.project });
initializeSessionTools({ client, server, defaultProject: config.project });
initializeAnnotationConfigTools({ client, server });
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
