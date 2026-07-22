---
"@arizeai/phoenix-evals": major
---

Upgrade `@arizeai/phoenix-evals` to AI SDK v7. Evaluator telemetry uses the AI SDK v7 telemetry API with a per-call `OpenTelemetry` integration from `@ai-sdk/otel`, while preserving application logging, metrics, and other non-tracing globally registered integrations (global OpenTelemetry integrations are excluded per call to avoid duplicate spans). The `telemetry.tracer` and `telemetry.isEnabled` options keep working as before, and system messages in prompt templates continue to be supported. Requires Node.js >=22.12 and AI SDK v7-compatible model providers (e.g. `@ai-sdk/openai` v4).
