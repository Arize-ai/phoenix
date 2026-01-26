# Phoenix Tracing: TypeScript Setup

**Setup Phoenix tracing in TypeScript/JavaScript with `@arizeai/phoenix-otel`.**

## Quick Start (3 lines)

```typescript
import { register } from "@arizeai/phoenix-otel";
register({ projectName: "my-app" });
```

**Connects to `http://localhost:6006`, batch processing enabled.**

## Installation

```bash
npm install @arizeai/phoenix-otel
```

**Requires:** Node.js 22+

## Configuration

### Environment Variables (Recommended)

```bash
export PHOENIX_API_KEY="your-api-key"  # Required for Phoenix Cloud
export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"  # Or Cloud URL
export PHOENIX_PROJECT_NAME="my-app"  # Optional
```

### TypeScript Code

```typescript
import { register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app",              // Project name
  url: "http://localhost:6006",       // Phoenix endpoint
  apiKey: process.env.PHOENIX_API_KEY, // API key
  batch: true,                        // Batch processing (default: true)
});
```

## ESM vs CommonJS

### CommonJS (Auto-instrumentation)

```javascript
const { register } = require("@arizeai/phoenix-otel");
register({ projectName: "my-app" });

const OpenAI = require("openai");
// OpenAI automatically instrumented
```

### ESM (Manual instrumentation required)

```typescript
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

register({ projectName: "my-app" });

// Manually instrument for ESM
const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({ instrumentations: [instrumentation] });
```

**ESM requires `manuallyInstrument()` because imports are hoisted.**

## Framework Integration

### Next.js (App Router)

```typescript
// instrumentation.ts (root of project)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register } = await import("@arizeai/phoenix-otel");
    register({ projectName: "my-nextjs-app" });
  }
}
```

### Express.js

```typescript
import express from "express";
import { register } from "@arizeai/phoenix-otel";

// Register BEFORE creating app
register({ projectName: "my-express-app" });

const app = express();
// ... routes ...
```

## Batch Processing (Production)

Enabled by default. Configure via environment variables:

```bash
export OTEL_BSP_SCHEDULE_DELAY=5000           # Batch every 5s
export OTEL_BSP_MAX_QUEUE_SIZE=2048           # Queue 2048 spans
export OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512     # Send 512 spans/batch
```

**Link:** https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/

## Verification

1. Open Phoenix UI: `http://localhost:6006`
2. Navigate to your project
3. Run your application
4. Check for traces

**Enable diagnostic logging:**
```typescript
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
register({ projectName: "my-app" });
```

## Troubleshooting

**No traces:**
- Verify `PHOENIX_COLLECTOR_ENDPOINT`
- Set `PHOENIX_API_KEY` for Phoenix Cloud
- For ESM: Ensure `manuallyInstrument()` called

**Missing attributes:**
- Check span kind (see rules/ directory)
- Verify instrumentation (ESM requires manual setup)

## Example (ESM)

```typescript
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

register({ projectName: "my-chatbot" });

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);
registerInstrumentations({ instrumentations: [instrumentation] });

const client = new OpenAI();
const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## API Reference

- [TypeScript API Docs](https://arize-ai.github.io/phoenix/)
