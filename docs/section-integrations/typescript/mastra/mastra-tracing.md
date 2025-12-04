---
description: Instrument agent applications built with Mastra
---

# Mastra Tracing

Mastra is an agentic framework that simplifies building complex AI applications with multi-agent workflows, tool integrations, and memory management.

## Launch Phoenix

{% include "../../.gitbook/includes/ts-launch-phoenix.md" %}

## Install

```bash
npm install @mastra/arize
```

## Configure Environment

Create a `.env` file that points Mastra to your Phoenix instance:

```bash
PHOENIX_ENDPOINT=http://localhost:6006/v1/traces
PHOENIX_API_KEY=your-api-key # Optional for local Phoenix
PHOENIX_PROJECT_NAME=mastra-service # Optional, defaults to "mastra-service"
```

## Setup

Initialize the Arize AX exporter inside your Mastra project:

```typescript
import { Mastra } from "@mastra/core";
import { ArizeExporter } from "@mastra/arize";

export const mastra = new Mastra({
  // ... other config (agents, workflows, etc.)
  observability: {
    configs: {
      arize: {
        serviceName: process.env.PHOENIX_PROJECT_NAME || "mastra-service",
        exporters: [
          new ArizeExporter({
            endpoint: process.env.PHOENIX_ENDPOINT!,
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: process.env.PHOENIX_PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

## Create Agents and Tools

From here you can use Mastra as normal. Create agents with tools and run them:

```typescript
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core";
import { ArizeExporter } from "@mastra/arize";
import { z } from "zod";

// Create a simple weather tool
const weatherTool = {
  name: "weatherTool",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("The city and country"),
  }),
  execute: async ({ location }) => {
    // Simulate weather API call
    return {
      location,
      temperature: "22°C",
      condition: "Sunny",
      humidity: "60%",
    };
  },
};

// Create an agent
const weatherAgent = new Agent({
  name: "Weather Assistant",
  instructions: "You help users get weather information. Use the weather tool to get current conditions.",
  model: openai("gpt-4o-mini"),
  tools: { weatherTool },
});

// Register the agent with Mastra instance
const mastra = new Mastra({
  agents: { weatherAgent },
  observability: {
    configs: {
      arize: {
        serviceName: process.env.PHOENIX_PROJECT_NAME || "mastra-service",
        exporters: [
          new ArizeExporter({
            endpoint: process.env.PHOENIX_ENDPOINT!,
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: process.env.PHOENIX_PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

## Running Your Application

**To test your application with Phoenix tracing:**

```bash
# Start the Mastra dev server
mastra dev

## or, build and run the production server with instrumentation enabled
# npm run build
# node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
```

This will:

1. Initialize the tracing SDK with your observability configuration
2. Start the Mastra playground at `http://localhost:4111`
3. Enable trace export to Phoenix at `http://localhost:6006`

**Interact with your agents:**

* **Via Playground:** Navigate to `http://localhost:4111/playground` to chat with agents
* **Via API:** Make requests to the generated API endpoints
* **Programmatically:** Create test scripts that run within the Mastra dev environment

## Observe

Now that you have tracing setup, all agent runs, tool calls, and model interactions will be streamed to your running Phoenix for observability and evaluation.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mastra-traces.png" %}

## Resources

* [Working example](https://github.com/Arize-ai/phoenix/tree/main/tutorials/agents/mastra/example-agent)
* [Mastra CLI Documentation](https://mastra.ai/en/docs/getting-started/installation)
