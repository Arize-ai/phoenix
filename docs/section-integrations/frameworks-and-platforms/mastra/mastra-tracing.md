---
description: Instrument agent applications built with Mastra
---

# Mastra Tracing

Mastra is an agentic framework that simplifies building complex AI applications with multi-agent workflows, tool integrations, and memory management.

## Launch Phoenix

{% include "../../.gitbook/includes/ts-launch-phoenix.md" %}

## Install

```bash
npm install @arizeai/openinference-mastra@^2.2.0 @mastra/core
npm install -D mastra 
```

## Setup

Initialize OpenTelemetry tracing for your Mastra application:

```typescript
import { Mastra } from '@mastra/core/mastra';
import {
  OpenInferenceOTLPTraceExporter,
  isOpenInferenceSpan,
} from "@arizeai/openinference-mastra";

export const mastra = new Mastra({
  // ... other config (agents, workflows, etc.)
  telemetry: {
    serviceName: "my-mastra-app",
    enabled: true,
    export: {
      type: "custom",
      tracerName: "my-mastra-app",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT + "/v1/traces",
        headers: {
          Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`,
        },
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});
```

## ℹ️ Running with Mastra Dev Server

Phoenix tracing is enabled only when running your app with the Mastra dev server:

- Use **`mastra dev`** to send traces to Phoenix.
- Running scripts directly (e.g., with `node` or `tsx`) will not enable tracing.


## Create Agents and Tools

From here you can use Mastra as normal. Create agents with tools and run them:

```typescript
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
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
      humidity: "60%"
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
  telemetry: {
    serviceName: "mastra-weather-agent",
    enabled: true,
    export: {
      type: "custom",
      tracerName: "mastra-weather-agent",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT + "/v1/traces",
        headers: {
          Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`,
        },
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});
```

## Running Your Application

**To start your application with Phoenix tracing:**

```bash
# Start the Mastra dev server (required for tracing)
mastra dev
```

This will:
1. Generate OpenTelemetry instrumentation files in `.mastra/output/`
2. Initialize the tracing SDK with your telemetry configuration  
3. Start the Mastra playground at `http://localhost:4111`
4. Enable trace export to Phoenix at `http://localhost:6006`

**Interact with your agents:**

- **Via Playground:** Navigate to `http://localhost:4111/playground` to chat with agents
- **Via API:** Make requests to the generated API endpoints  
- **Programmatically:** Create test scripts that run within the mastra dev environment


## Observe

Now that you have tracing setup, all agent runs, tool calls, and model interactions will be streamed to your running Phoenix for observability and evaluation.
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mastra-traces.png" %}

## Resources

* [Working example](https://github.com/Arize-ai/phoenix/tree/main/tutorials/agents/mastra/example-agent)
* [Mastra CLI Documentation](https://mastra.ai/en/docs/getting-started/installation)