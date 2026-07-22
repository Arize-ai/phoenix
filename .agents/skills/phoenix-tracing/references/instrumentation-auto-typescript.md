# Auto-Instrumentation (TypeScript)

Automatically create spans for LLM calls without code changes.

## Supported Frameworks

- **LLM SDKs:** OpenAI
- **Frameworks:** LangChain, Vercel AI SDK
- **Install:** `npm install @arizeai/openinference-instrumentation-{name}`
  (the Vercel AI SDK is traced through `@arizeai/phoenix-otel` directly — see below)

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

## Vercel AI SDK

The Vercel AI SDK (v7+) emits its own OpenTelemetry spans; `@arizeai/phoenix-otel`
processes them (via `@arizeai/openinference-vercel`) and exports them to Phoenix. No
per-call instrumentation is needed.

**Version compatibility** — the runtime is ESM-only, so match versions:

| Vercel AI SDK | `@arizeai/phoenix-otel` | `@arizeai/openinference-vercel` |
| ------------- | ----------------------- | ------------------------------- |
| v7+           | 2.x                     | 3.x                             |
| v6 and older  | 1.x                     | 2.x                             |

AI SDK v7 telemetry requires Node.js 22+.

**Install:**

```bash
npm i --save ai @ai-sdk/otel @arizeai/phoenix-otel
```

**Setup** — since AI SDK v7, telemetry only flows once you register a telemetry
integration with `registerTelemetry`. `register()` does **not** do this for you:

```typescript
// instrumentation.ts
import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

// Reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY from the environment.
export const provider = register({ projectName: "my-ai-sdk-app" });

// headers: false keeps outgoing LLM request headers (which can carry
// credentials) off the spans. This is unrelated to Phoenix auth.
registerTelemetry(new OpenTelemetry({ headers: false }));
```

Import this file before the rest of the program, e.g.
`node --import ./instrumentation.ts index.ts`. After that, `generateText`,
`streamText`, and `ToolLoopAgent` runs are traced end to end with no per-call config.

**Note:** `register()` uses a batch span processor by default. In a short-lived
script, call `await provider.shutdown()` before exit to flush queued spans, or pass
`batch: false` to `register()` for immediate export.

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
