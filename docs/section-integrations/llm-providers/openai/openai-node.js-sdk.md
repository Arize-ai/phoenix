---
description: Instrument and observe OpenAI calls
---

# OpenAI Node.js SDK

This module provides automatic instrumentation for the [OpenAI Node.js SDK](https://github.com/openai/openai-node). which may be used in conjunction with [@opentelemetry/sdk-trace-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node).

## Install

```bash
npm install --save @arizeai/openinference-instrumentation-openai openai

npm install --save @opentelemetry/api @opentelemetry/sdk-trace-node \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/instrumentation \
  @opentelemetry/exporter-trace-otlp-proto \
  @arizeai/openinference-semantic-conventions
```

## Setup

To instrument your application, import and enable `OpenAIInstrumentation`

Create the `instrumentation.js` file:

<pre class="language-typescript"><code class="lang-typescript">import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
<strong>import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
</strong>import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
// OpenAI instrumentation
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

const COLLECTOR_ENDPOINT = "your-phoenix-collector-endpoint";
const SERVICE_NAME = "openai-app";

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_PROJECT_NAME]: SERVICE_NAME,
  }),
  spanProcessors: [
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: `${COLLECTOR_ENDPOINT}/v1/traces`,
        // (optional) if connecting to Phoenix with Authentication enabled
        headers: { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` },
      })
    ),
  ],
});

provider.register();
console.log("Provider registered");

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});

console.log("OpenAI instrumentation registered");
</code></pre>

## Run OpenAI <a href="#run-beeai" id="run-beeai"></a>

Import the `instrumentation.js` file first, then use OpenAI as usual.

```typescript
import "./instrumentation.js"; 
import OpenAI from "openai";

// set OPENAI_API_KEY in environment, or pass it in arguments
const openai = new OpenAI({
    apiKey: 'your-openai-api-key'
});

openai.chat.completions
  .create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Write a haiku."}],
  })
  .then((response) => {
    console.log(response.choices[0].message.content);
  });
```

## Observe

After setting up instrumentation and running your  OpenAI application, traces will appear in the Phoenix UI for visualization and analysis.

## Resources

* [Example project](https://github.com/Arize-ai/openinference/tree/main/js/examples/openai)
* [OpenInference package for OpenAI Node.js SDK](https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai)
