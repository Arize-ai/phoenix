# register() API

## Key Behavior: `global` Parameter

- `global: true` (default): attaches provider to OTel globals and binds auto-detach to `shutdown()`.
- `global: false`: provider is NOT attached. Callers can attach manually via `attachGlobalTracerProvider()`. This is how phoenix-client experiments use it.

## Span Processors

When `spanProcessors` is provided, those are used directly. Otherwise `getDefaultSpanProcessor()` creates an OTLP-backed processor.

The re-exported `BatchSpanProcessor` / `SimpleSpanProcessor` (`src/spanProcessors.ts`) subclass the SDK ones and throw on a missing `{ exporter }`, so the 2.x positional form fails at construction instead of dropping spans.

## Sampler and Span Limits

`sampler` and `spanLimits` pass straight to the SDK `TracerProvider`. OTel JS 3 ignores the `OTEL_TRACES_SAMPLER`, `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*` and `OTEL_BSP_*` variables; `register()` does not emulate them, but warns once per variable when one is set and the matching setting is not configured in code (`sampler`, the matching `spanLimits` field, or, for `OTEL_BSP_*`, the default batch processor). The `BatchSpanProcessor` subclass warns about `OTEL_BSP_*` variables whose option it was not given. The shared latch and variable tables live in `src/ignoredOtelEnvVars.ts`.

## Environment Variable Fallbacks

`PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` are used as fallbacks for the `url` and `apiKey` params respectively. Explicit params always take precedence.
