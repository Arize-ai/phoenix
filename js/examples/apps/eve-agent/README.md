# Vercel Eve Agent Tracing

A minimal [Vercel Eve](https://eve.dev/) agent traced with
`@arizeai/phoenix-otel`. Eve auto-discovers
[`agent/instrumentation.ts`](./agent/instrumentation.ts) at server startup;
its `register()` call handles the provider and global wiring, with an
OpenInference span processor passed via `spanProcessors` to keep only AI spans.
Every turn then lands in Phoenix as one trace: the `ai.eve.turn` root, each
model step, and the [`get_weather`](./agent/tools/get_weather.ts) tool call.

See the [Vercel Eve integration docs](https://arize.com/docs/phoenix/integrations/typescript/vercel/eve-tracing)
for a full walkthrough of reading Eve traces in Phoenix.

## Prerequisites

- Node.js >= 24 (required by Eve's CLI)
- A running Phoenix instance (defaults to `http://localhost:6006`)
- `OPENAI_API_KEY` set in your environment (the agent uses a direct
  `@ai-sdk/openai` model; swap [`agent/agent.ts`](./agent/agent.ts) to a
  gateway model id to use the Vercel AI Gateway)

## Run

```shell
# From the js/ directory
pnpm install

export OPENAI_API_KEY=sk-...
pnpm --filter eve-agent dev
```

`eve dev` opens an interactive terminal UI on `http://127.0.0.1:2000` — send a
message like "What's the weather in Brooklyn?" there, or over HTTP:

```shell
curl -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"What is the weather in Brooklyn?"}'
```

Open [http://localhost:6006](http://localhost:6006) to see the trace in the
`eve-agent` project.

## Configuration

| Environment variable         | Description                          | Default                 |
| ---------------------------- | ------------------------------------ | ----------------------- |
| `OPENAI_API_KEY`             | OpenAI API key                       | required                |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint                | `http://localhost:6006` |
| `PHOENIX_API_KEY`            | Phoenix API key (if auth is enabled) | none                    |
| `PHOENIX_PROJECT_NAME`       | Phoenix project to send traces to    | the agent name          |
