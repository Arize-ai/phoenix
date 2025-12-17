---
hidden: true
---

# MCP Tracing

The `@arizeai/openinference-instrumentation-mcp` instrumentor is unique compared to other OpenInference instrumentors. It does not generate any of its own telemetry. Instead, it enables context propagation between MCP clients and servers to unify traces. **You still need to generate OpenTelemetry traces in both the client and server to see a unified trace.**

## Install

```bash
npm install @arizeai/openinference-instrumentation-mcp
```

You will also need to install the Phoenix OTEL package:

```bash
npm install @arizeai/phoenix-otel
```

{% hint style="warning" %}
Because the MCP instrumentor does not generate its own telemetry, you must use it alongside other instrumentation code to see traces.
{% endhint %}

The example code below uses OpenAI, which you can instrument using:

```bash
npm install @arizeai/openinference-instrumentation-openai
```

{% include "../.gitbook/includes/ts-launch-phoenix (1).md" %}

## Add Tracing to your MCP Client

First, create an instrumentation file to set up OpenTelemetry:

```typescript
// client.ts
import { register } from "@arizeai/phoenix-otel";
import { MCPInstrumentation } from "@arizeai/openinference-instrumentation-mcp";
import * as MCPClientStdioModule from "@modelcontextprotocol/sdk/client/stdio";
import * as MCPServerStdioModule from "@modelcontextprotocol/sdk/server/stdio";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

// Set up Phoenix tracing
const provider = register({
  projectName: "financial-analysis-client",
});

const mcpInstrumentation = new MCPInstrumentation();
// MCP must be manually instrumented as it doesn't have a traditional module structure
mcpInstrumentation.manuallyInstrument({
  clientStdioModule: MCPClientStdioModule,
  serverStdioModule: MCPServerStdioModule,
});

async function runMCPClient() {
  // Spawn the MCP server process
  const serverProcess = spawn("node", ["server.js"], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  // Create transport and client
  const transport = new StdioClientTransport({
    reader: serverProcess.stdout!,
    writer: serverProcess.stdin!,
  });

  const client = new Client(
    {
      name: "financial-analysis-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  await client.connect(transport);

  // Example: Use an analyze_stock tool
  const result = await client.callTool({
    name: "analyze_stock",
    arguments: {
      ticker: "AAPL",
    },
  });

runMCPClient().catch(console.error);
```

## Add Tracing to your MCP Server

```typescript
// server.ts
import { register, trace } from "@arizeai/phoenix-otel";
import { MCPInstrumentation } from "@arizeai/openinference-instrumentation-mcp";
import * as MCPClientStdioModule from "@modelcontextprotocol/sdk/client/stdio";
import * as MCPServerStdioModule from "@modelcontextprotocol/sdk/server/stdio";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Set up Phoenix tracing
const provider = register({
  projectName: "financial-analysis-server",
});

const mcpInstrumentation = new MCPInstrumentation();
mcpInstrumentation.manuallyInstrument({
  clientStdioModule: MCPClientStdioModule,
  serverStdioModule: MCPServerStdioModule,
});

// Create MCP server
const server = new Server(
  {
    name: "financial-analysis-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Get a tracer for additional instrumentation
const tracer = trace.getTracer("financial-analysis-server");

// Insert code for server 

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP server running on stdio");
}

main().catch(console.error);
```

## Observe

Now that you have tracing setup, all invocations of your client and server will be streamed to Phoenix for observability and evaluation, and connected in the platform.

<figure><img src="../../../.gitbook/assets/MCP tracing.png" alt=""><figcaption></figcaption></figure>

### Resources

* [End to end example](https://github.com/Arize-ai/phoenix/tree/main/tutorials/mcp/tracing_between_mcp_client_and_server)
* [OpenInference MCP package](https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-mcp)
