# Tracing the Vercel AI SDK (v7) with @arizeai/phoenix-otel

This example shows how to trace [Vercel AI SDK](https://ai-sdk.dev/) v7 calls
with Phoenix. `register()` from `@arizeai/phoenix-otel` sets up the
OpenTelemetry provider and the OpenInference span processors; the application
then registers the AI SDK telemetry integration explicitly — the AI SDK v7
telemetry registry is process-global, so `@arizeai/phoenix-otel` never
registers it for you.

## Version compatibility

| Vercel AI SDK | @arizeai/phoenix-otel |
| ------------- | --------------------- |
| v7+           | 2.x (this example)    |
| v6 and older  | 1.x                   |

AI SDK v7 requires Node.js 22.12 or newer.

## Running the example

Start Phoenix (e.g. `phoenix serve` or Phoenix Cloud), then:

```bash
npm install
export OPENAI_API_KEY=your-openai-key
# For Phoenix Cloud or a remote collector:
# export PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/<your-space>
# export PHOENIX_API_KEY=your-phoenix-key
npm start
```

Traces appear in the `ai-sdk-v7-example` project.

## How it works

- [`instrumentation.ts`](./instrumentation.ts) registers the Phoenix provider
  and the AI SDK `OpenTelemetry` integration from `@ai-sdk/otel`. Header
  capture is disabled because request headers can contain credentials.
- [`main.ts`](./main.ts) imports the instrumentation first, makes a traced
  `generateText` call, and flushes pending spans before exit.
