<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-otel-ts">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        @arizeai/phoenix-otel
    </div>
</h1>
<p align="center">
    <a href="https://www.npmjs.com/package/@arizeai/phoenix-otel">
        <img src="https://img.shields.io/npm/v/@arizeai/phoenix-otel" alt="NPM Version">
    </a>
    <a href="https://arize.com/docs/phoenix">
        <img src="https://img.shields.io/badge/docs-blue?logo=readthedocs&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=js/packages/phoenix-otel/README.md" />
</p>

A lightweight wrapper around OpenTelemetry for Node.js applications that simplifies sending traces to [Arize Phoenix](https://github.com/Arize-ai/phoenix). `@arizeai/phoenix-otel` handles provider registration and OTLP export, then re-exports the full `@arizeai/openinference-core` helper surface from the same package path so you can register tracing and author manual spans from one import.

> **Note**: This package is under active development and APIs may change.

## Features

- **Simple Setup** - One-line configuration with sensible defaults
- **Environment Variables** - Automatic configuration from environment variables
- **Batch Processing** - Built-in batch span processing for production use
- **OpenInference Helpers Included** - Re-exports `withSpan`, `traceChain`, `traceAgent`, `traceTool`, `observe`, context setters, attribute builders, `OITracer`, and utility helpers
- **Provider-Swap Safe Wrappers** - The re-exported OpenInference helpers resolve the default tracer when the wrapped function executes, so module-scoped wrappers continue following global provider changes
- **Agent-Friendly Local Docs** - Ships curated docs and source in `node_modules/@arizeai/phoenix-otel/`

## Installation

```bash
npm install @arizeai/phoenix-otel
```

## Quick Start

### Basic Usage

The simplest way to get started is to use `register()` together with the built-in tracing helpers:

```typescript
import { register, traceChain } from "@arizeai/phoenix-otel";

const provider = register({
  projectName: "my-app",
});

const answerQuestion = traceChain(
  async (question: string) => `Handled: ${question}`,
  { name: "answer-question" }
);

await answerQuestion("What is Phoenix?");
await provider.shutdown();
```

`register()` sets up the Phoenix exporter. The tracing helpers come from `@arizeai/openinference-core`, re-exported through `@arizeai/phoenix-otel`.

### Production Setup

For production use with Phoenix Cloud:

```typescript
import { register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app",
  url: "https://app.phoenix.arize.com",
  apiKey: process.env.PHOENIX_API_KEY,
});
```

## Configuration

### Environment Variables

The `register` function automatically reads from environment variables:

```bash
# For local Phoenix server (default)
export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"

# For Phoenix Cloud
export PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com"
export PHOENIX_API_KEY="your-api-key"
```

### Configuration Options

The `register` function accepts the following parameters:

| Parameter          | Type                     | Default                   | Description                                            |
| ------------------ | ------------------------ | ------------------------- | ------------------------------------------------------ |
| `projectName`      | `string`                 | `"default"`               | The project name for organizing traces in Phoenix      |
| `url`              | `string`                 | `"http://localhost:6006"` | The URL to your Phoenix instance                       |
| `apiKey`           | `string`                 | `undefined`               | API key for Phoenix authentication                     |
| `headers`          | `Record<string, string>` | `{}`                      | Custom headers for OTLP requests                       |
| `batch`            | `boolean`                | `true`                    | Use batch span processing (recommended for production) |
| `instrumentations` | `Instrumentation[]`      | `undefined`               | Array of OpenTelemetry instrumentations to register    |
| `global`           | `boolean`                | `true`                    | Register the tracer provider globally                  |
| `diagLogLevel`     | `DiagLogLevel`           | `undefined`               | Diagnostic logging level for debugging                 |

## Usage Examples

### With Auto-Instrumentation

Automatically instrument common libraries (works best with CommonJS):

```typescript
import { register } from "@arizeai/phoenix-otel";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";

register({
  projectName: "my-express-app",
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});
```

> **Note**: Auto-instrumentation via the `instrumentations` parameter works best with CommonJS projects. ESM projects require manual instrumentation.

### With OpenAI (ESM)

For ESM projects, manually instrument libraries:

```typescript
// instrumentation.ts
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

register({
  projectName: "openai-app",
});

// Manual instrumentation for ESM
const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});
```

```typescript
// main.ts
import "./instrumentation.ts";
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Tracing Helpers

The package includes `withSpan`, `traceChain`, `traceAgent`, and `traceTool` for wrapping functions with OpenInference spans. Each helper automatically records inputs, outputs, errors, and span kind.

```typescript
import {
  register,
  traceAgent,
  traceChain,
  traceTool,
  withSpan,
} from "@arizeai/phoenix-otel";

register({ projectName: "my-app" });

// traceTool — for tool calls and API lookups
const searchDocs = traceTool(
  async (query: string) => {
    const response = await fetch(`/api/search?q=${query}`);
    return response.json();
  },
  { name: "search-docs" }
);

// traceChain — for pipeline steps and orchestration
const summarize = traceChain(
  async (text: string) => `Summary of ${text.length} chars`,
  { name: "summarize" }
);

// traceAgent — for autonomous agent entry points
const supportAgent = traceAgent(
  async (question: string) => {
    const docs = await searchDocs(question);
    return summarize(JSON.stringify(docs));
  },
  { name: "support-agent" }
);

// withSpan — general purpose, specify kind explicitly
const retrieveDocs = withSpan(
  async (query: string) =>
    fetch(`/api/search?q=${query}`).then((r) => r.json()),
  { name: "retrieve-docs", kind: "RETRIEVER" }
);
```

These helpers resolve the default tracer when the wrapped function runs, so traced functions defined at module scope keep following global provider changes.

### Custom Input And Output Processing

Use `processInput` and `processOutput` when you want richer OpenInference attributes than the default JSON-serialized `input.value` and `output.value`.

```typescript
import {
  OpenInferenceSpanKind,
  getInputAttributes,
  getRetrieverAttributes,
  withSpan,
} from "@arizeai/phoenix-otel";

const retrieveDocs = withSpan(
  async (query: string) => [`Doc A for ${query}`, `Doc B for ${query}`],
  {
    name: "retrieve-docs",
    kind: OpenInferenceSpanKind.RETRIEVER,
    processInput: (query) => getInputAttributes(query),
    processOutput: (documents) =>
      getRetrieverAttributes({
        documents: documents.map((content, index) => ({
          id: `doc-${index}`,
          content,
        })),
      }),
  }
);
```

### Context Attributes

Propagate session IDs, user IDs, metadata, and tags to all child spans using context setters:

```typescript
import {
  context,
  register,
  setMetadata,
  setSession,
  setUser,
  traceChain,
} from "@arizeai/phoenix-otel";

register({ projectName: "my-app" });

const handleQuery = traceChain(async (query: string) => `Handled: ${query}`, {
  name: "handle-query",
});

// All spans inside context.with() inherit session, user, and metadata
await context.with(
  setMetadata(
    setUser(setSession(context.active(), { sessionId: "sess-123" }), {
      userId: "user-456",
    }),
    { environment: "production" }
  ),
  () => handleQuery("Hello")
);
```

Available setters: `setSession`, `setUser`, `setMetadata`, `setTags`, `setAttributes`, `setPromptTemplate`.

If you create spans manually with a plain OpenTelemetry tracer, copy the propagated context attributes onto the span explicitly:

```typescript
import {
  context,
  getAttributesFromContext,
  register,
  trace,
} from "@arizeai/phoenix-otel";

register({ projectName: "my-app" });

const tracer = trace.getTracer("manual-tracer");
const span = tracer.startSpan("manual-span");
span.setAttributes(getAttributesFromContext(context.active()));
span.end();
```

### Decorators

`observe` wraps class methods with tracing while preserving method `this` context. Use TypeScript 5+ standard decorators.

```typescript
import { OpenInferenceSpanKind, observe } from "@arizeai/phoenix-otel";

class ChatService {
  @observe({ kind: OpenInferenceSpanKind.CHAIN })
  async runWorkflow(message: string) {
    return `processed: ${message}`;
  }

  @observe({ name: "llm-call", kind: OpenInferenceSpanKind.LLM })
  async callModel(prompt: string) {
    return `model output for: ${prompt}`;
  }
}
```

### Attribute Helper APIs

Use the attribute helpers when you want to build OpenInference-compatible span attributes directly:

```typescript
import { getLLMAttributes, trace } from "@arizeai/phoenix-otel";

const tracer = trace.getTracer("llm-service");

tracer.startActiveSpan("llm-inference", (span) => {
  span.setAttributes(
    getLLMAttributes({
      provider: "openai",
      modelName: "gpt-4o-mini",
      inputMessages: [{ role: "user", content: "What is Phoenix?" }],
      outputMessages: [{ role: "assistant", content: "Phoenix is..." }],
      tokenCount: { prompt: 12, completion: 44, total: 56 },
      invocationParameters: { temperature: 0.2 },
    })
  );
  span.end();
});
```

Available helpers include:

- `getLLMAttributes`
- `getEmbeddingAttributes`
- `getRetrieverAttributes`
- `getToolAttributes`
- `getMetadataAttributes`
- `getInputAttributes` / `getOutputAttributes`
- `defaultProcessInput` / `defaultProcessOutput`

### Trace Config And Redaction

`OITracer` wraps an OpenTelemetry tracer and can redact or drop sensitive OpenInference attributes before spans are written:

```typescript
import {
  OITracer,
  OpenInferenceSpanKind,
  trace,
  withSpan,
} from "@arizeai/phoenix-otel";

const tracer = new OITracer({
  tracer: trace.getTracer("my-service"),
  traceConfig: {
    hideInputs: true,
    hideOutputText: true,
    hideEmbeddingVectors: true,
    base64ImageMaxLength: 8_000,
  },
});

const safeLLMCall = withSpan(
  async (prompt: string) => `model response for ${prompt}`,
  {
    tracer,
    kind: OpenInferenceSpanKind.LLM,
    name: "safe-llm-call",
  }
);
```

Supported environment variables include:

- `OPENINFERENCE_HIDE_INPUTS`
- `OPENINFERENCE_HIDE_OUTPUTS`
- `OPENINFERENCE_HIDE_INPUT_MESSAGES`
- `OPENINFERENCE_HIDE_OUTPUT_MESSAGES`
- `OPENINFERENCE_HIDE_INPUT_IMAGES`
- `OPENINFERENCE_HIDE_INPUT_TEXT`
- `OPENINFERENCE_HIDE_OUTPUT_TEXT`
- `OPENINFERENCE_HIDE_EMBEDDING_VECTORS`
- `OPENINFERENCE_BASE64_IMAGE_MAX_LENGTH`
- `OPENINFERENCE_HIDE_PROMPTS`

### Raw OpenTelemetry Spans

For full control over attributes and timing, use the OpenTelemetry API directly:

```typescript
import { register, trace, SpanStatusCode } from "@arizeai/phoenix-otel";

register({ projectName: "my-app" });

const tracer = trace.getTracer("my-service");

async function processOrder(orderId: string) {
  return tracer.startActiveSpan("process-order", async (span) => {
    try {
      span.setAttribute("order.id", orderId);
      const result = await fetchOrderDetails(orderId);
      span.setAttribute("order.status", result.status);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Utility Helpers

The package also re-exports small utilities from `@arizeai/openinference-core`:

- `withSafety({ fn, onError? })` wraps a function and returns `null` on error
- `safelyJSONStringify(value)` and `safelyJSONParse(value)` guard JSON operations

### Development vs Production

**Development** (with debug logging):

```typescript
import { DiagLogLevel, register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app-dev",
  url: "http://localhost:6006",
  batch: false, // Immediate span delivery for faster feedback
  diagLogLevel: DiagLogLevel.DEBUG,
});
```

**Production** (optimized for performance):

```typescript
import { register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app-prod",
  url: "https://app.phoenix.arize.com",
  apiKey: process.env.PHOENIX_API_KEY,
  batch: true, // Batch processing for better performance
});
```

### Custom Headers

Add custom headers to OTLP requests:

```typescript
import { register } from "@arizeai/phoenix-otel";

register({
  projectName: "my-app",
  url: "https://app.phoenix.arize.com",
  headers: {
    "X-Custom-Header": "custom-value",
    "X-Environment": process.env.NODE_ENV || "development",
  },
});
```

### Non-Global Provider

Use the provider explicitly without registering globally:

```typescript
import { register } from "@arizeai/phoenix-otel";

const provider = register({
  projectName: "my-app",
  global: false,
});

// Use the provider explicitly
const tracer = provider.getTracer("my-tracer");
```

## Docs And Source Code In `node_modules`

After install, a coding agent can inspect the exact versioned docs and implementation that shipped with the package:

```text
node_modules/@arizeai/phoenix-otel/docs/
node_modules/@arizeai/phoenix-otel/src/
```

Because `@arizeai/phoenix-otel` re-exports `@arizeai/openinference-core`, the dependency docs are also useful local references:

```text
node_modules/@arizeai/openinference-core/docs/
node_modules/@arizeai/openinference-core/src/
```

## Coding Agent Skill

The Phoenix repo includes a [phoenix-tracing skill](https://github.com/Arize-ai/phoenix/tree/main/.agents/skills/phoenix-tracing) that teaches coding agents (Claude Code, Cursor, etc.) how to instrument LLM applications with OpenInference tracing. Install it with:

```bash
npx skills add Arize-ai/phoenix --skill phoenix-tracing
```

Tracing helpers:

```typescript
import {
  observe,
  traceAgent,
  traceChain,
  traceTool,
  withSpan,
} from "@arizeai/phoenix-otel";
```

Context attribute setters:

```typescript
import {
  setAttributes,
  setMetadata,
  setPromptTemplate,
  setSession,
  setTags,
  setUser,
} from "@arizeai/phoenix-otel";
```

Attribute builders for rich span data:

```typescript
import {
  defaultProcessInput,
  defaultProcessOutput,
  getEmbeddingAttributes,
  getLLMAttributes,
  getRetrieverAttributes,
  getToolAttributes,
} from "@arizeai/phoenix-otel";
```

Redaction and utility helpers:

```typescript
import {
  OITracer,
  safelyJSONParse,
  safelyJSONStringify,
  withSafety,
} from "@arizeai/phoenix-otel";
```

The tracing helper wrappers resolve the default tracer when they run. That keeps spans attached to the current provider in experiments and in any workflow that swaps providers during process lifetime.

## Documentation

- **[Phoenix Documentation](https://arize.com/docs/phoenix)** - Complete Phoenix documentation
- **[@arizeai/phoenix-otel package docs](https://arize.com/docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-otel)** - Curated website docs for this package
- **[@arizeai/openinference-core package docs](https://arize.com/docs/phoenix/sdk-api-reference/typescript/arizeai-openinference-core)** - Upstream helper and attribute-builder reference
- **[OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)** - OpenTelemetry for JavaScript
- **[OpenInference](https://github.com/Arize-ai/openinference)** - OpenInference semantic conventions

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g)
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix)
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues)
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix)
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45)
