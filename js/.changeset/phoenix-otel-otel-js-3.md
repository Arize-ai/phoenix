---
"@arizeai/phoenix-otel": major
"@arizeai/phoenix-client": major
"@arizeai/phoenix-cli": minor
---

Move `@arizeai/phoenix-otel` to OpenTelemetry JS 3 (`@opentelemetry/sdk-trace` 3.x, `@opentelemetry/api` 1.10) so spans created by apps on OpenTelemetry JS 3 are recorded after `register()`. `register()` now returns the `@opentelemetry/sdk-trace` `TracerProvider` (still exported as the `NodeTracerProvider` type), which no longer has a `register()` method. Custom `spanProcessors` must come from `@opentelemetry/sdk-trace` and take an options object, e.g. `new BatchSpanProcessor({ exporter })`. Node.js 22.15 or newer is now required.
