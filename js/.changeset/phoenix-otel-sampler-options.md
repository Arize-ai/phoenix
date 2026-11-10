---
"@arizeai/phoenix-otel": minor
---

`register()` accepts `sampler` and `spanLimits`, and `AlwaysOnSampler`, `AlwaysOffSampler`, `ParentBasedSampler`, and `TraceIdRatioBasedSampler` are re-exported. `register()` warns once when `OTEL_TRACES_SAMPLER`, `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*`, or `OTEL_BSP_*` variables are set, since OpenTelemetry JS 3 ignores them. The re-exported `BatchSpanProcessor` and `SimpleSpanProcessor` throw a `TypeError` when given an exporter positionally instead of `{ exporter }`, rather than dropping every span.
