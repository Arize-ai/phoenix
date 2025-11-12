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
</p>

A lightweight wrapper around OpenTelemetry for Node.js applications that simplifies sending traces to [Arize Phoenix](https://github.com/Arize-ai/phoenix). This package provides an easy-to-use `register` function that handles all the boilerplate configuration for OpenTelemetry tracing.

> **Note**: This package is under active development and APIs may change.

## Features

- **Simple Setup** - One-line configuration with sensible defaults
- **Environment Variables** - Automatic configuration from environment variables
- **Batch Processing** - Built-in batch span processing for production use

## Installation

```bash
npm install @arizeai/phoenix-otel
```

## Quick Start

### Basic Usage

The simplest way to get started is to use the `register` function:

```typescript
import { register } from "@arizeai/phoenix-otel";

// Register with default settings (connects to localhost:6006)
register({
  projectName: "my-app",
});
```

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

### Manual Tracing

Create custom spans using the OpenTelemetry API:

```typescript
import { register, trace } from "@arizeai/phoenix-otel";

register({ projectName: "my-app" });

const tracer = trace.getTracer("my-service");

async function processOrder(orderId: string) {
  return tracer.startActiveSpan("process-order", async (span) => {
    try {
      span.setAttribute("order.id", orderId);

      // Your business logic here
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

### Development vs Production

**Development** (with debug logging):

```typescript
import { register } from "@arizeai/phoenix-otel";
import { DiagLogLevel } from "@opentelemetry/api";

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

## Re-exported APIs

For convenience, commonly used OpenTelemetry APIs are re-exported:

```typescript
import {
  trace, // Main tracing API
  context, // Context API
  SpanStatusCode, // Span status codes
  registerInstrumentations, // Register instrumentations
  type DiagLogLevel, // Diagnostic log levels
  type Tracer, // Tracer type
  type Instrumentation, // Instrumentation type
  type NodeTracerProvider, // Provider type
} from "@arizeai/phoenix-otel";
```

## Documentation

- **[Phoenix Documentation](https://arize.com/docs/phoenix)** - Complete Phoenix documentation
- **[OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)** - OpenTelemetry for JavaScript
- **[OpenInference](https://github.com/Arize-ai/openinference)** - OpenInference semantic conventions

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg)
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix)
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues)
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix)
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45)
