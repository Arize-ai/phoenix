---
description: Instrument and observe OpenAI calls
---

# OpenAI Node.js SDK

This module provides automatic instrumentation for the [OpenAI Node.js SDK](https://github.com/openai/openai-node). which may be used in conjunction with [@opentelemetry/sdk-trace-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node).

## Install

```bash
npm install --save @arizeai/openinference-instrumentation-openai \
  @arizeai/phoenix-otel \
  openai
```

## Setup

To instrument your application, import and enable `OpenAIInstrumentation`.

Create the `instrumentation.ts` (or `.js`) file:

{% tabs %}
{% tab title="ESM Project" %}
```typescript
// instrumentation.ts
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

// Register Phoenix OTEL with automatic configuration
const provider = register({
  projectName: "openai-app",
});

// Manually instrument OpenAI for ESM projects
const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});

console.log("✅ OpenAI instrumentation registered");
```

{% hint style="info" %}
**ESM Projects:** You must manually instrument OpenAI by calling `instrumentation.manuallyInstrument(OpenAI)` before using the OpenAI client.
{% endhint %}
{% endtab %}

{% tab title="CommonJS Project" %}
```typescript
// instrumentation.ts
import { register } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

// Register Phoenix OTEL with automatic instrumentation
const provider = register({
  projectName: "openai-app",
  instrumentations: [new OpenAIInstrumentation()],
});

console.log("✅ OpenAI instrumentation registered");
```

{% hint style="info" %}
**CommonJS Projects:** Auto-instrumentation works automatically by passing the `OpenAIInstrumentation` to the `instrumentations` parameter.
{% endhint %}
{% endtab %}
{% endtabs %}

### Configuration

The `register` function automatically reads from environment variables:

- `PHOENIX_COLLECTOR_ENDPOINT` - Your Phoenix instance URL (defaults to `http://localhost:6006`)
- `PHOENIX_API_KEY` - Your Phoenix API key for authentication

You can also configure these directly:

```typescript
const provider = register({
  projectName: "openai-app",
  url: "https://app.phoenix.arize.com",
  apiKey: process.env.PHOENIX_API_KEY,
});
```

## Run OpenAI <a href="#run-beeai" id="run-beeai"></a>

Import the `instrumentation.ts` file first, then use OpenAI as usual.

```typescript
// main.ts
import "./instrumentation.ts"; 
import OpenAI from "openai";

// Set OPENAI_API_KEY in environment, or pass it in arguments
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

openai.chat.completions
  .create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Write a haiku." }],
  })
  .then((response) => {
    console.log(response.choices[0].message.content);
  })
  // Keep process alive for BatchSpanProcessor to flush traces
  .then(() => new Promise((resolve) => setTimeout(resolve, 6000)));
```

Run your application:

```bash
# Set your API keys
export OPENAI_API_KEY='your-openai-api-key'
export PHOENIX_COLLECTOR_ENDPOINT='http://localhost:6006'  # or your Phoenix URL
export PHOENIX_API_KEY='your-phoenix-api-key' 

# Run the application
node main.ts
# Or using --require flag
node --require ./instrumentation.ts main.ts
```

## Observe

After setting up instrumentation and running your  OpenAI application, traces will appear in the Phoenix UI for visualization and analysis.


## Resources

* [Example project](https://github.com/Arize-ai/openinference/tree/main/js/examples/openai)
* [OpenInference package for OpenAI Node.js SDK](https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai)
