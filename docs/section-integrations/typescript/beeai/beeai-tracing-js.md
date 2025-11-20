---
description: Auto-instrument and observe BeeAI agents
---

# BeeAI Tracing (JS)

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/beeai_architecture.jpeg" alt=""><figcaption><p>BeeAI has native integration with Arize Phoenix</p></figcaption></figure>

<div align="left"><img src="https://img.shields.io/npm/v/%40arizeai%2Fopeninference-instrumentation-beeai" alt="NPM Version"></div>

This module provides **automatic instrumentation** for [BeeAI framework](https://github.com/i-am-bee/beeai-framework/tree/main). It integrates seamlessly with the [@opentelemetry/sdk-trace-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node) package to collect and export telemetry data.

## Install

```shell
npm install --save beeai-framework \
  @arizeai/openinference-instrumentation-beeai \
  @arizeai/phoenix-otel
```

## Setup

To instrument your application, import and enable BeeAIInstrumentation. Create the `instrumentation.ts` file:

```typescript
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import * as beeaiFramework from "beeai-framework";
import { BeeAIInstrumentation } from "@arizeai/openinference-instrumentation-beeai";

const provider = register({
  projectName: "beeai-project",
});

const beeAIInstrumentation = new BeeAIInstrumentation();
beeAIInstrumentation.manuallyInstrument(beeaiFramework);

registerInstrumentations({
  instrumentations: [beeAIInstrumentation],
});

console.log("👀 OpenInference initialized");
```

## Run BeeAI

Sample agent built using BeeAI with automatic tracing:

```typescript
import "./instrumentation.ts";
import { ToolCallingAgent } from "beeai-framework/agents/toolCalling/agent";
import { TokenMemory } from "beeai-framework/memory/tokenMemory";
import { DuckDuckGoSearchTool } from "beeai-framework/tools/search/duckDuckGoSearch";
import { OpenMeteoTool } from "beeai-framework/tools/weather/openMeteo";
import { OpenAIChatModel } from "beeai-framework/adapters/openai/backend/chat";

const llm = new OpenAIChatModel(
  "gpt-4o", 
  {},
  { apiKey: process.env.OPENAI_API_KEY }
);

const agent = new ToolCallingAgent({
  llm,
  memory: new TokenMemory(),
  tools: [
    new DuckDuckGoSearchTool(),
    new OpenMeteoTool(), // weather tool
  ],
});

async function main() {
  const response = await agent.run({ prompt: "What's the current weather in Berlin?" });
  console.log(`Agent 🤖 : `, response.result.text);
}

main();
```

## Observe

Phoenix provides visibility into your BeeAI agent operations by automatically tracing all interactions.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/beeai-js-phoenix.png" %}


## Resources

* [BeeAI Framework GitHub](https://github.com/i-am-bee/beeai-framework)
* [OpenInference BeeAI Instrumentation Package](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-beeai)
* [OpenTelemetry Node.js SDK Documentation](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
* [BeeAI Examples](https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-beeai/examples)
