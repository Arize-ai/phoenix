# AI SDK Quickstart

The smallest [Vercel AI SDK](https://ai-sdk.dev/) v7 app traced with
`@arizeai/phoenix-otel`. Importing [`instrumentation.ts`](./instrumentation.ts)
registers Phoenix telemetry; [`main.ts`](./main.ts) then makes a single
`generateText` call that shows up as a trace in Phoenix.

## Version compatibility

| Vercel AI SDK | @arizeai/phoenix-otel |
| ------------- | --------------------- |
| v7+           | 2.x (this example)    |
| v6 and older  | 1.x                   |

AI SDK v7 requires Node.js 22.12 or newer.

## Prerequisites

- Node.js >= 22.12
- A running Phoenix instance (defaults to `http://localhost:6006`)
- `OPENAI_API_KEY` set in your environment

## Run

```shell
# From the js/ directory
pnpm install

export OPENAI_API_KEY=sk-...
pnpm --filter ai-sdk-quickstart start
```

Open [http://localhost:6006](http://localhost:6006) to see the trace in the
`ai-sdk-quickstart` project.

## Configuration

| Environment variable         | Description                          | Default                 |
| ---------------------------- | ------------------------------------ | ----------------------- |
| `OPENAI_API_KEY`             | OpenAI API key                       | required                |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint                | `http://localhost:6006` |
| `PHOENIX_API_KEY`            | Phoenix API key (if auth is enabled) | none                    |
