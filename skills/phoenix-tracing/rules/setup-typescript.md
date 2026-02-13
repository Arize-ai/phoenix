# TypeScript Setup

Setup Phoenix tracing in TypeScript/JavaScript with `@arizeai/phoenix-otel`.

## Metadata

| Attribute | Value |
|-----------|-------|
| Priority | Critical - required for all tracing |
| Setup Time | <5 min |

## Quick Start

```bash
npm install @arizeai/phoenix-otel
```

```typescript
import { register } from "@arizeai/phoenix-otel";
register({ projectName: "my-app" });
```

Connects to `http://localhost:6006` by default.

## Configuration

```typescript
import { register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app",
  url: "http://localhost:6006",
  apiKey: process.env.PHOENIX_API_KEY,
  batch: true
});
```

**Environment variables:**

```bash
export PHOENIX_API_KEY="your-api-key"
export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"
export PHOENIX_PROJECT_NAME="my-app"
```

## ESM vs CommonJS

**CommonJS (automatic):**

```javascript
const { register } = require("@arizeai/phoenix-otel");
register({ projectName: "my-app" });

const OpenAI = require("openai");
```

**ESM (manual instrumentation required):**

```typescript
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

register({ projectName: "my-app" });

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);
registerInstrumentations({ instrumentations: [instrumentation] });
```

**Why:** ESM imports are hoisted, so `manuallyInstrument()` is needed.

## Framework Integration

**Next.js (App Router):**

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register } = await import("@arizeai/phoenix-otel");
    register({ projectName: "my-nextjs-app" });
  }
}
```

**Express.js:**

```typescript
import { register } from "@arizeai/phoenix-otel";

register({ projectName: "my-express-app" });

const app = express();
```

## Flushing Spans Before Exit

**CRITICAL for short-lived processes:** Must call `provider.shutdown()` before exit to flush batched spans.

Batch processors queue spans and export periodically. Processes that exit quickly (scripts, tests, batch jobs) don't run long enough for the export cycle, so spans are lost without explicit shutdown.

**Standard pattern:**

```typescript
const provider = register({
  projectName: "my-app",
  batch: true,
});

async function main() {
  await doWork();
  await provider.shutdown();  // Flush spans before exit
}

main().catch(async (error) => {
  console.error(error);
  await provider.shutdown();  // Flush on error too
  process.exit(1);
});
```

**Alternative for scripts that don't need batching:**

```typescript
// No shutdown needed - spans export immediately
register({
  projectName: "my-app",
  batch: false,
});
```

For production patterns including long-lived processes, see `production-typescript.md`.

## Verification

1. Open Phoenix UI: `http://localhost:6006`
2. Run your application
3. Check for traces in your project

**Enable diagnostic logging:**

```typescript
import { DiagLogLevel, register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app",
  diagLogLevel: DiagLogLevel.DEBUG,
});
```

## Troubleshooting

**No traces:**
- Verify `PHOENIX_COLLECTOR_ENDPOINT` is correct
- Set `PHOENIX_API_KEY` for Phoenix Cloud
- For ESM: Ensure `manuallyInstrument()` is called
- **Short-lived processes:** Call `provider.shutdown()` before exit (see Flushing Spans section)

**Traces not appearing for scripts/batch jobs:**
- With `batch: true`: Must call `await provider.shutdown()` before process exit
- Quick fix: Set `batch: false` for immediate export (no shutdown needed)
- Long-lived processes: Use `batch: true` (better performance)

**Missing attributes:**
- Check instrumentation is registered (ESM requires manual setup)
- See `instrumentation-auto-typescript.md`

## See Also

- **Auto-instrumentation:** `instrumentation-auto-typescript.md`
- **Manual instrumentation:** `instrumentation-manual-typescript.md`
- **API docs:** https://arize-ai.github.io/phoenix/
