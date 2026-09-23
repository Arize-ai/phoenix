# Auto-Instrumentation (TypeScript)

Automatically create spans for LLM calls without code changes.

## Supported Frameworks

- **LLM SDKs:** OpenAI
- **Frameworks:** LangChain
- **Install:** `npm install @arizeai/openinference-instrumentation-{name}`
- **Vercel AI SDK:** not an instrumentation — registered separately, see below

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

The AI SDK is **not** covered by the `instrumentations` array above. AI SDK v7 no
longer emits spans through the global tracer provider on its own, and its telemetry
registry is process-global — so the application must register the integration
explicitly. Install `ai` and `@ai-sdk/otel`, then register alongside `register()`:

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
  })
);
```

Consider disabling AI SDK request-header capture — headers can carry authorization
tokens and cookies. See the `@arizeai/phoenix-otel` README and the `@ai-sdk/otel`
docs for the current option name.

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

Import the instrumentation module *first* so the telemetry registration happens
before any AI SDK call.

**Version constraint:** `@arizeai/phoenix-otel` 2.x translates AI SDK v7
(`@ai-sdk/otel`) spans. AI SDK v6 and older emit a different span shape that 2.x
does **not** translate — stay on `@arizeai/phoenix-otel` 1.x (with
`@arizeai/openinference-vercel` 2.x) for AI SDK v6.

To export only AI spans, or to wire the OpenInference processors yourself, see the
Custom Span Processors section in `setup-typescript.md`.

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
