# register() API

## Key Behavior: `global` Parameter

- `global: true` (default): attaches provider to OTel globals and binds auto-detach to `shutdown()`.
- `global: false`: provider is NOT attached. Callers can attach manually via `attachGlobalTracerProvider()`. This is how phoenix-client experiments use it.

## Span Processors

When `spanProcessors` is provided, those are used directly. Otherwise `getDefaultSpanProcessor()` creates an OTLP-backed processor.

The default processor lazily loads `@arizeai/openinference-vercel` processors (still on `sdk-trace-base` 2.x; duck-typed, so they work in the 3.x provider). Custom processors come from `@opentelemetry/sdk-trace` 3.x.

## Environment Variable Fallbacks

`PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` are used as fallbacks for the `url` and `apiKey` params respectively. Explicit params always take precedence.
