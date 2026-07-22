---
"@arizeai/phoenix-evals": major
---

Upgrade `@arizeai/phoenix-evals` to AI SDK v7. Evaluator telemetry uses the AI SDK v7 telemetry API with a per-call `OpenTelemetry` integration from `@ai-sdk/otel`, while preserving all globally registered integrations (logging, metrics, and tracing to other backends); a Phoenix tracing integration is appended unless a global integration already traces with the same tracer. Evaluator spans now follow the OpenTelemetry `gen_ai.*` conventions emitted by `@ai-sdk/otel` instead of the AI SDK v6 `ai.*` span format. The `telemetry.tracer` and `telemetry.isEnabled` options keep working as before, and system messages in prompt templates continue to be supported. Requires Node.js >=22.12 and AI SDK v7-compatible model providers (e.g. `@ai-sdk/openai` v4).
