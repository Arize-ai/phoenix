# Auto-Instrumentation (TypeScript)

Automatically create spans for LLM calls without code changes.

## Supported Frameworks

- **LLM SDKs:** OpenAI
- **Frameworks:** LangChain, Vercel AI SDK (v7+)
- **Install:** `npm install @arizeai/openinference-instrumentation-{name}`

The Vercel AI SDK is instrumented through its built-in telemetry (below), not
through an `@arizeai/openinference-instrumentation-*` package.

## Setup

**CommonJS (automatic):**

```javascript
const { register } = require("@arizeai/phoenix-otel");
const OpenAI = require("openai");

register({ projectName: "my-app" });

const client = new OpenAI();
```

**ESM (manual required):**

```typescript
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

register({ projectName: "my-app" });

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);
registerInstrumentations({ instrumentations: [instrumentation] });
```

**Why:** ESM imports are hoisted before `register()` runs.

## Vercel AI SDK (v7+)

`register()` does **not** auto-register AI SDK telemetry — the v7 telemetry
registry is process-global, so the application must configure it explicitly.
Install `ai` and `@ai-sdk/otel`, then register the integration against the
Phoenix provider's tracer:

```bash
npm install @arizeai/phoenix-otel ai @ai-sdk/otel
```

```typescript
// instrumentation.ts
import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";
import { register } from "@arizeai/phoenix-otel";

const provider = register({
  projectName: "my-ai-app",
});

registerTelemetry(
  new OpenTelemetry({
    tracer: provider.getTracer("@arizeai/phoenix-otel/ai-sdk"),
    // Disables LLM request-header span capture (headers can hold tokens);
    // unrelated to Phoenix auth.
    headers: false,
  })
);
```

```typescript
// main.ts
import "./instrumentation.ts";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Write a short story about a cat.",
});
```

**Version compatibility:** `@arizeai/phoenix-otel` 2.x emits correct spans for
AI SDK **v7+**. AI SDK v6 and older emit a different span shape — use
`@arizeai/phoenix-otel` 1.x for those.

## Limitations

**What auto-instrumentation does NOT capture:**

```typescript
async function myWorkflow(query: string): Promise<string> {
  const preprocessed = await preprocess(query);        // Not traced
  const response = await client.chat.completions.create(...);  // Traced (auto)
  const postprocessed = await postprocess(response);   // Not traced
  return postprocessed;
}
```

**Solution:** Add manual instrumentation for custom logic:

```typescript
import { traceChain } from "@arizeai/openinference-core";

const myWorkflow = traceChain(
  async (query: string): Promise<string> => {
    const preprocessed = await preprocess(query);
    const response = await client.chat.completions.create(...);
    const postprocessed = await postprocess(response);
    return postprocessed;
  },
  { name: "my-workflow" }
);
```

## Combining Auto + Manual

```typescript
import { register } from "@arizeai/phoenix-otel";
import { traceChain } from "@arizeai/openinference-core";

register({ projectName: "my-app" });

const client = new OpenAI();

const workflow = traceChain(
  async (query: string) => {
    const preprocessed = await preprocess(query);
    const response = await client.chat.completions.create(...);  // Auto-instrumented
    return postprocess(response);
  },
  { name: "my-workflow" }
);
```
