# Phoenix Tracing: Auto-Instrumentation (TypeScript)

**Automatically create spans for LLM calls without code changes.**

## Overview

Auto-instrumentation patches supported libraries at runtime to create spans automatically. Use for supported frameworks (LangChain, OpenAI SDK, etc.). For custom logic, manual-instrumentation-typescript.md.

## Supported Frameworks

**TypeScript/JavaScript:**
- LLM SDKs: OpenAI
- Frameworks: LangChain
- Install: `npm install @arizeai/openinference-instrumentation-{name}`

## Setup

**Install:**
```bash
npm install @arizeai/phoenix-otel
npm install @arizeai/openinference-instrumentation-openai  # Add others as needed
```

**CommonJS (automatic):**
```javascript
const { register } = require("@arizeai/phoenix-otel");
const OpenAI = require("openai");

register({ projectName: "my-app" });

const client = new OpenAI();
// Auto-instrumented
```

**ESM (manual required):**
```typescript
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

register({ projectName: "my-app" });

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);  // Required for ESM
registerInstrumentations({ instrumentations: [instrumentation] });

const client = new OpenAI();
```

ESM requires `manuallyInstrument()` because imports are hoisted before `register()` runs.

## Limitations

Auto-instrumentation does NOT capture:
- Custom business logic
- Internal function calls
- Non-OpenInference attributes

**Example:**
```typescript
async function myCustomWorkflow(query: string): Promise<string> {
  const preprocessed = await preprocess(query);  // Not traced
  const response = await client.chat.completions.create(...);  // Traced (auto)
  const postprocessed = await postprocess(response);  // Not traced
  return postprocessed;
}
```

**Solution:** Add manual instrumentation:
```typescript
import { traceChain } from "@arizeai/openinference-core";

const myCustomWorkflow = traceChain(
  async (query: string): Promise<string> => {
    const preprocessed = await preprocess(query);
    const response = await client.chat.completions.create(...);
    const postprocessed = await postprocess(response);
    return postprocessed;
  },
  { name: "my-custom-workflow" }
);
```

## Troubleshooting

**No traces:**
- Check instrumentor installed: `npm list | grep openinference`
- Check `register()` called before imports (ESM)
- Check `PHOENIX_COLLECTOR_ENDPOINT` matches Phoenix server

**Missing attributes:**
- Update instrumentor: `npm update @arizeai/openinference-instrumentation-openai`
- Check library version compatibility
- Add manual instrumentation for custom logic

**Conflicts:**
- Use selective instrumentation and only enable needed instrumentors

## Combining Auto + Manual

```typescript
import { register } from "@arizeai/phoenix-otel";
import { traceChain } from "@arizeai/openinference-core";
import OpenAI from "openai";

register({ projectName: "my-app" });

const client = new OpenAI();  // Auto-instrumented

const myWorkflow = traceChain(
  async (query: string): Promise<string> => {
    const preprocessed = await preprocess(query);
    const response = await client.chat.completions.create(...);  // Auto-instrumented
    return postprocess(response);
  },
  { name: "my-workflow" }
);
```

## Best Practices

- Install only needed instrumentors (not `*`)
- Keep instrumentors updated
- Use auto-instrumentation first, add manual instrumentation for gaps
- Auto-instrumentation covers ~80% with zero effort

## Next Steps

- Add custom spans
- Organize traces
- Enrich traces
- Production deployment
