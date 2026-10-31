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
export PHOENIX_PROJECT="my-app"  # PHOENIX_PROJECT_NAME is a supported alias
```

`PHOENIX_PROJECT` is the canonical project-name variable and takes precedence;
`PHOENIX_PROJECT_NAME` is a supported alias. If both are set to different
values, `PHOENIX_PROJECT` wins and a one-time warning naming both is logged.

### Credential File Discovery (`.env.phoenix`)

When a setting is not passed to `register()` or set in the process environment,
`@arizeai/phoenix-otel` looks for a `.env.phoenix` file in the current working
directory — walking up toward the filesystem root and stopping at the first
match — and reads `PHOENIX_`-prefixed keys from it (dotenv format):

```bash
# .env.phoenix
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
PHOENIX_API_KEY=your-api-key
```

Explicit arguments and environment variables always win — the file never
overrides anything already set. Set `PHOENIX_DISCOVER_CONFIG=false` to disable
discovery.

## Custom Span Processors

`register()` accepts `spanProcessors?: SpanProcessor[]`, which **replaces** the
default Phoenix exporter setup rather than adding to it. For these setups you do
not need to install the underlying OTel/OpenInference packages:

- The package root re-exports `OTLPTraceExporter` and `ensureCollectorEndpoint`.
- The **ESM-only** subpath `@arizeai/phoenix-otel/vercel` re-exports
  `@arizeai/openinference-vercel` — `OpenInferenceSimpleSpanProcessor`,
  `OpenInferenceBatchSpanProcessor`, `isOpenInferenceSpan`, and types.

```typescript
import {
  ensureCollectorEndpoint,
  OTLPTraceExporter,
  register,
} from "@arizeai/phoenix-otel";
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/phoenix-otel/vercel";

register({
  projectName: "my-agent",
  spanProcessors: [
    new OpenInferenceSimpleSpanProcessor({
      exporter: new OTLPTraceExporter({
        url: ensureCollectorEndpoint("http://localhost:6006"),
      }),
      // Export only AI spans, re-rooting any left orphaned by the filter
      spanFilter: isOpenInferenceSpan,
      reparentOrphanedSpans: true,
    }),
  ],
});
```

`ensureCollectorEndpoint()` normalizes a Phoenix base URL into the OTLP traces
endpoint, so pass the same URL you would give `register({ url })`.

**The `/vercel` subpath has no CommonJS build** — `@arizeai/openinference-vercel`
is ESM-only, which is why these re-exports are not on the package root. From CJS,
use `LazyOpenInferenceSpanProcessor` (exported from the root), which loads the
processors via dynamic `import()` and buffers spans recorded before the load
resolves:

```typescript
new LazyOpenInferenceSpanProcessor({ exporter, batch });  // batch: boolean
```

If the module cannot be loaded at all (e.g. a bundler stripped dynamic imports),
it falls back to the plain OTel batch/simple processors and emits a diagnostic
warning: spans still reach Phoenix, but AI SDK telemetry is not translated to
OpenInference. This is the processor `register()` uses by default.

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

**CRITICAL:** Spans may not be exported if still queued in the processor when your process exits. Call `provider.shutdown()` to explicitly flush before exit.

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

**Alternative:**

```typescript
// Use batch: false for immediate export (no shutdown needed)
register({
  projectName: "my-app",
  batch: false,
});
```

For production patterns including graceful termination, see `production-typescript.md`.

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
- **With `batch: true`:** Call `provider.shutdown()` before exit to flush queued spans (see Flushing Spans section)

**Traces missing:**
- With `batch: true`: Call `await provider.shutdown()` before process exit to flush queued spans
- Alternative: Set `batch: false` for immediate export (no shutdown needed)

**Missing attributes:**
- Check instrumentation is registered (ESM requires manual setup)
- See `instrumentation-auto-typescript.md`

## See Also

- **Auto-instrumentation:** `instrumentation-auto-typescript.md`
- **Manual instrumentation:** `instrumentation-manual-typescript.md`
- **API docs:** https://arize-ai.github.io/phoenix/
