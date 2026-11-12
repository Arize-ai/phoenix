---
"@arizeai/phoenix-otel": minor
---

`register()` accepts `sampler` and `spanLimits`, and `AlwaysOnSampler`, `AlwaysOffSampler`, `ParentBasedSampler`, and `TraceIdRatioBasedSampler` are re-exported. When `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*`, or `OTEL_BSP_*` is set and the matching setting is not configured in code, `register()` (or, for `OTEL_BSP_*` with custom processors, the re-exported `BatchSpanProcessor`) logs one warning per variable, since OpenTelemetry JS 3 ignores them. The re-exported `BatchSpanProcessor` and `SimpleSpanProcessor` throw a `TypeError` when given an exporter positionally instead of `{ exporter }`, rather than dropping every span.
