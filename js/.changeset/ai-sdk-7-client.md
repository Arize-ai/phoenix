---
"@arizeai/phoenix-client": major
---

Require AI SDK v7 for `@arizeai/phoenix-client`. `ai` v7 is now an optional peer dependency. AI SDK v7 no longer emits OpenTelemetry spans through the global tracer provider on its own — to trace AI SDK calls made inside experiment tasks, register the `@ai-sdk/otel` integration at startup with a swap-safe tracer from `@arizeai/phoenix-otel`: `registerTelemetry(new OpenTelemetry({ tracer: getTracer("ai") }))` (see `examples/run_experiment_with_ai_sdk.ts`). Phoenix evaluators from `@arizeai/phoenix-evals` are traced automatically and need no setup. Core client APIs retain Node.js 18 compatibility; AI SDK v7-backed features require the Node.js version supported by AI SDK v7.
