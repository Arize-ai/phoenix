# OpenAI SDK Quickstart

A minimal ESM app that validates the Phoenix TypeScript packages against the
raw [OpenAI Node SDK](https://github.com/openai/openai-node):

- **Tracing** — `@arizeai/phoenix-otel` +
  `@arizeai/openinference-instrumentation-openai` using manual ESM
  instrumentation (`manuallyInstrument`)
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

The script makes a chat completion request, evaluates the response with an
LLM-as-a-judge classifier, and prints the result. Open
[http://localhost:6006](http://localhost:6006) to see the traces in the
`openai-quickstart` project.

## Configuration

| Environment variable         | Description                          | Default                 |
| ---------------------------- | ------------------------------------ | ----------------------- |
| `OPENAI_API_KEY`             | OpenAI API key (app + judge)         | required                |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint                | `http://localhost:6006` |
| `PHOENIX_API_KEY`            | Phoenix API key (if auth is enabled) | none                    |
