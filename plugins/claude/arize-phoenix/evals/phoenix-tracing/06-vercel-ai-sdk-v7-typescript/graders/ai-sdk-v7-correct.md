---
type: llm
focus: {source: file, path: aiSdkTracing.ts}
weight: 0.5
---
The app uses the Vercel AI SDK v7, where calling Phoenix's `register()` alone is not enough — v7 no longer emits spans through the global tracer provider on its own, so the AI SDK's telemetry must be registered explicitly and pointed at the Phoenix tracer provider.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The setup wires the AI SDK's telemetry to Phoenix explicitly — it registers the AI SDK OpenTelemetry integration (e.g. `registerTelemetry` with `@ai-sdk/otel`) using the tracer/provider returned by Phoenix's `register()`. Merely calling `register()` and relying on the old per-call `experimental_telemetry` flag, with no explicit AI SDK telemetry registration pointed at the Phoenix provider, fails this claim.
