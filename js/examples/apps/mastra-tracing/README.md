# Mastra Tracing Example

A minimal ESM app that validates the Phoenix TypeScript packages against a
[Mastra](https://mastra.ai/) agent:

- **Tracing** — Mastra `Observability` + `@mastra/arize` exporting agent
  traces to Phoenix
- **AI SDK v7 providers** — the agent's model comes from `@ai-sdk/openai` v4
  (the AI SDK v7 provider line)
- **Evals** — `@arizeai/phoenix-evals` (which runs on AI SDK v7 internally)
  judging the response

Unlike the `mastra-agent` and `mastra-quickstart` examples, this app runs the
agent in-process with a single script — no Mastra dev server required.

## Prerequisites

- Node.js >= 22.13
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

The script runs a tool-calling weather agent, evaluates the response with an
LLM-as-a-judge classifier, and prints the result. Open
[http://localhost:6006](http://localhost:6006) to see the traces in the
`mastra-tracing` project.

## Configuration

| Environment variable         | Description                          | Default                 |
| ---------------------------- | ------------------------------------ | ----------------------- |
| `OPENAI_API_KEY`             | OpenAI API key (agent + judge)       | required                |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint                | `http://localhost:6006` |
| `PHOENIX_API_KEY`            | Phoenix API key (if auth is enabled) | none                    |
| `PHOENIX_PROJECT_NAME`       | Phoenix project for traces           | `mastra-tracing`        |
