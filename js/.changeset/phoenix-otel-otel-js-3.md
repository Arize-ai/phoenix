---
"@arizeai/phoenix-otel": major
"@arizeai/phoenix-client": major
"@arizeai/phoenix-cli": minor
---

Move `@arizeai/phoenix-otel` to OpenTelemetry JS 3 (`@opentelemetry/sdk-trace` 3.x, `@opentelemetry/api` 1.10) so spans created by apps on OpenTelemetry JS 3 are recorded after `register()`. `register()` now returns the `@opentelemetry/sdk-trace` `TracerProvider` (still exported as the `NodeTracerProvider` type), which no longer has a `register()` method. Custom `spanProcessors` must come from `@opentelemetry/sdk-trace` and take an options object, e.g. `new BatchSpanProcessor({ exporter })`; `BatchSpanProcessor` and `SimpleSpanProcessor` are now re-exported from `@arizeai/phoenix-otel`. See the package's `MIGRATION.md`. A `tracerProvider` passed to `@arizeai/phoenix-client` `evaluateExperiment()` must now be an `@opentelemetry/sdk-trace` 3.x `TracerProvider`. `register()` no longer applies the `OTEL_TRACES_SAMPLER`, `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*`, or `OTEL_BSP_*` environment variables. Node.js 22.15 or newer is now required.
