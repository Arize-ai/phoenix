# BeeAI Tracing (JS)

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/beeai_architecture.jpeg" alt=""><figcaption><p>BeeAI has native integration with Arize Phoenix</p></figcaption></figure>

<div align="left"><img src="https://img.shields.io/npm/v/%40arizeai%2Fopeninference-instrumentation-beeai" alt="NPM Version"></div>

This module provides **automatic instrumentation** for [BeeAI framework](https://github.com/i-am-bee/beeai-framework/tree/main). It integrates seamlessly with the [@opentelemetry/sdk-trace-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node) package to collect and export telemetry data.

### Installation

```shell
npm install --save @arizeai/openinference-instrumentation-beeai beeai-framework

npm install --save @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/semantic-conventions @arizeai/openinference-semantic-conventions
```

### Usage

To instrument your application, import and enable BeeAIInstrumentation

1. Create the `instrumentation.js` file:

```typescript
// instrumentation.js
import { NodeSDK, node, resources } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { BeeAIInstrumentation } from "@arizeai/openinference-instrumentation-beeai";
import * as beeaiFramework from "beeai-framework";

// Initialize Instrumentation Manually
const beeAIInstrumentation = new BeeAIInstrumentation();

const provider = new NodeSDK({
  resource: new resources.Resource({
    [ATTR_SERVICE_NAME]: "beeai",
    [SEMRESATTRS_PROJECT_NAME]: "beeai-project",
  }),
  spanProcessors: [
    new node.SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: "http://localhost:6006/v1/traces",
      }),
    ),
  ],
  instrumentations: [beeAIInstrumentation],
});

await provider.start();

// Manually Patch BeeAgent (This is needed when the module is not loaded via require (commonjs))
console.log("🔧 Manually instrumenting BeeAgent...");
beeAIInstrumentation.manuallyInstrument(beeaiFramework);
console.log("✅ BeeAgent manually instrumented.");

// eslint-disable-next-line no-console
console.log("👀 OpenInference initialized");
```

2. Import the library and call the BeeAI framework

```typescript
import "./instrumentation";
import { BeeAgent } from "beeai-framework/agents/bee/agent";
import { TokenMemory } from "beeai-framework/memory/tokenMemory";
import { DuckDuckGoSearchTool } from "beeai-framework/tools/search/duckDuckGoSearch";
import { OpenMeteoTool } from "beeai-framework/tools/weather/openMeteo";
import { OllamaChatModel } from "beeai-framework/adapters/ollama/backend/chat";

const llm = new OllamaChatModel("llama3.1");
const agent = new BeeAgent({
  llm,
  memory: new TokenMemory(),
  tools: [new DuckDuckGoSearchTool(), new OpenMeteoTool()],
});

const response = await agent.run({
  prompt: "What's the current weather in Berlin?",
});

console.log(`Agent 🤖 : `, response.result.text);
```

For more information on OpenTelemetry Node.js SDK, see the [OpenTelemetry Node.js SDK documentation](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/).
