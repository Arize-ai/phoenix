---
"@arizeai/phoenix-otel": major
---

Upgrade `@arizeai/openinference-vercel` to v3, which translates AI SDK v7 (`@ai-sdk/otel`) spans to OpenInference. AI SDK telemetry remains explicitly application-configured because its registry is process-global. The package retains its Node.js 18 minimum and ESM/CommonJS entry points: because `@arizeai/openinference-vercel` v3 is ESM-only, the OpenInference span processors are loaded lazily via dynamic import (spans recorded before the load completes are buffered and replayed), and `LazyOpenInferenceSpanProcessor` is exported for custom provider setups. AI SDK v6 spans are no longer translated; stay on 1.x for AI SDK v6.
