# Mastra Tracing

## Launch Phoenix

{% include "../../.gitbook/includes/ts-launch-phoenix.md" %}

## Setup

**Install packages:**

```bash
npm install @arizeai/openinference-mastra
```

Initialize OpenTelemetry tracing for your Mastra application:

```typescript
import { Mastra } from "@mastra/core";
import {
  OpenInferenceOTLPTraceExporter,
  isOpenInferenceSpan,
} from "@arizeai/openinference-mastra";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "openinference-mastra-agent", // you can rename this to whatever you want to appear in the Phoenix UI
    enabled: true,
    export: {
      type: "custom",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT,
        headers: {
          Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`, // if you're self-hosting Phoenix without auth, you can remove this header
        },
        // optional: filter out http, and other node service specific spans
        // they will still be exported to Mastra, but not to the target of
        // this exporter
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});
```

From here you can use Mastra as normal. All agents, workflows, and tool calls will be automatically traced.

## Example Agent Walkthrough

Here is a full project example to get you started:

#### Launch Phoenix using one of the methods above

The rest of this tutorial will assume you are running Phoenix locally on the default `localhost:6006` port.

#### Create a new Mastra project

```bash
npm create mastra@latest
# answer the prompts, include agent, tools, and the example when asked

cd chosen-project-name
npm install --save @arizeai/openinference-mastra
```

#### Connect to Phoenix

Add the OpenInference telemetry code to your `index.js` file. The complete file should now look like this:

```typescript
// chosen-project-name/src/index.ts
import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { LibSQLStore } from "@mastra/libsql";
import {
  isOpenInferenceSpan,
  OpenInferenceOTLPTraceExporter,
} from "@arizeai/openinference-mastra";

import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    enabled: true,
    serviceName: "weather-agent",
    export: {
      type: "custom",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT,
        headers: {
          Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`,
        },
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});

```

#### Run the Agent

```bash
npm run dev
```

#### View your Traces in Phoenix

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mastra-traces.png" %}

### What Gets Traced

The Mastra instrumentation automatically captures:

* **Agent Executions**: Complete agent runs including instructions, model calls, and responses
* **Workflow Steps**: Individual step executions within workflows, including inputs, outputs, and timing
* **Tool Calls**: Function calls made by agents, including parameters and results
* **LLM Interactions**: All model calls with prompts, responses, token usage, and metadata
* **RAG Operations**: Vector searches, document retrievals, and embedding generations
* **Memory Operations**: Agent memory reads and writes
* **Error Handling**: Exceptions and error states in your AI pipeline

### Trace Attributes

Phoenix will capture detailed attributes for each trace:

* **Agent Information**: Agent name, instructions, model configuration
* **Workflow Context**: Workflow name, step IDs, execution flow
* **Tool Metadata**: Tool names, parameters, execution results
* **Model Details**: Model name, provider, token usage, response metadata
* **Performance Metrics**: Execution time, token counts, costs
* **User Context**: Session IDs, user information (if provided)

You can view all of this information in the Phoenix UI to debug issues, optimize performance, and understand your application's behavior.
