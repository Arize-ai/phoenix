# Anthropic SDK Quickstart

A minimal ESM app that validates the Phoenix TypeScript packages against the
raw [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript):

- **Tracing** — `@arizeai/phoenix-otel` +
  `@arizeai/openinference-instrumentation-anthropic` using manual ESM
  instrumentation (`manuallyInstrument`)
- **Evals** — `@arizeai/phoenix-evals` (which runs on AI SDK v7 internally)
  judging the response with an Anthropic model

## Prerequisites

- Node.js >= 22.12
- A running Phoenix instance (defaults to `http://localhost:6006`)
- `ANTHROPIC_API_KEY` set in your environment

```shell
# From the js/ directory
pnpm install

# Start Phoenix if you don't have one running
# see https://arize.com/docs/phoenix/self-hosting
```

## Run

```shell
export ANTHROPIC_API_KEY=sk-ant-...
pnpm start
```

The script makes a messages request, evaluates the response with an
LLM-as-a-judge classifier, and prints the result. Open
[http://localhost:6006](http://localhost:6006) to see the traces in the
`anthropic-quickstart` project.

## Configuration

| Environment variable         | Description                          | Default                 |
| ---------------------------- | ------------------------------------ | ----------------------- |
| `ANTHROPIC_API_KEY`          | Anthropic API key (app + judge)      | required                |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint                | `http://localhost:6006` |
| `PHOENIX_API_KEY`            | Phoenix API key (if auth is enabled) | none                    |
