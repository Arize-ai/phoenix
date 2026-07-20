# AI SDK v7 Quickstart

A minimal ESM app that validates the Phoenix TypeScript packages against the
[Vercel AI SDK](https://ai-sdk.dev/) v7:

- **Tracing** — `@arizeai/phoenix-otel` + `@ai-sdk/otel` via the AI SDK's
  process-global `registerTelemetry` API
- **Tool calling** — a multi-step `generateText` run with a weather tool
- **Evals** — `@arizeai/phoenix-evals` (which runs on AI SDK v7 internally)
  judging the response

## Prerequisites

- Node.js >= 22.12
- A running Phoenix instance (defaults to `http://localhost:6006`)
- `OPENAI_API_KEY` set in your environment

```shell
# From the js/ directory
pnpm install

# Start Phoenix if you don't have one running
# see https://arize.com/docs/phoenix/self-hosting
```

## Run

```shell
export OPENAI_API_KEY=sk-...
pnpm start
```

The script makes a tool-calling LLM request, evaluates the response with an
LLM-as-a-judge classifier, and prints the result. Open
[http://localhost:6006](http://localhost:6006) to see the traces for both the
agent run and the evaluator in the `ai-sdk-quickstart` project.

## Configuration

| Environment variable         | Description                          | Default                 |
| ---------------------------- | ------------------------------------ | ----------------------- |
| `OPENAI_API_KEY`             | OpenAI API key (agent + judge)       | required                |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint                | `http://localhost:6006` |
| `PHOENIX_API_KEY`            | Phoenix API key (if auth is enabled) | none                    |
