---
"@arizeai/phoenix-otel": minor
---

Add `getTracer`, a tracer that resolves the global tracer provider on every span so it survives `attachGlobalTracerProvider`/`detachGlobalTracerProvider` swaps. Use it for tracers created ahead of time — e.g. registering an AI SDK telemetry integration at startup while experiments mount their own provider per run.
