---
"@arizeai/phoenix-otel": minor
---

Re-export `OTLPTraceExporter` from the package root and add the ESM-only `@arizeai/phoenix-otel/vercel` subpath re-exporting `@arizeai/openinference-vercel` (span processors, `isOpenInferenceSpan`, and types). Custom span-processor setups — e.g. filtering Vercel AI SDK / Eve traces via `register()`'s `spanProcessors` option — can now import everything from `@arizeai/phoenix-otel` without installing the underlying packages.
