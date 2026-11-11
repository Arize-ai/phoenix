# Migrations

## v2.x to v3.0.0

Version 3 moves to OpenTelemetry JS 3 (`@opentelemetry/sdk-trace` 3.x, `@opentelemetry/api` 1.10).

### Requirements

- Node.js 22.15 or newer.
- `@opentelemetry/api` 1.10 or newer.
- Instrumentations compatible with `@opentelemetry/instrumentation` 0.301.

### Import span processors from `@arizeai/phoenix-otel`

`@opentelemetry/sdk-trace-base` and `@opentelemetry/sdk-trace-node` are replaced by `@opentelemetry/sdk-trace`.
`BatchSpanProcessor` and `SimpleSpanProcessor` are re-exported from `@arizeai/phoenix-otel`, and span processors take
an options object.

**Before:**

```ts
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const provider = register({
  spanProcessors: [new BatchSpanProcessor(exporter)],
});
```

**After:**

```ts
import { BatchSpanProcessor, register } from "@arizeai/phoenix-otel";

const provider = register({
  spanProcessors: [new BatchSpanProcessor({ exporter })],
});
```

### Replace `provider.register()` with `attachGlobalTracerProvider()`

`register()` returns the `@opentelemetry/sdk-trace` `TracerProvider`, which has no `register()` method. It is still
exported as the `NodeTracerProvider` type. To attach a provider created with `global: false`, call
`attachGlobalTracerProvider()`.

**Before:**

```ts
const provider = register({ global: false });
provider.register();
```

**After:**

```ts
import { attachGlobalTracerProvider, register } from "@arizeai/phoenix-otel";

const provider = register({ global: false });
attachGlobalTracerProvider(provider);
```

### `OTEL_*` sampler, span limit, and batch variables are not read

`register()` ignores `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*`, and
`OTEL_BSP_*`. To tune batching, pass a `BatchSpanProcessor` with options in `spanProcessors`. To set a sampler or
span limits, create a `TracerProvider` from `@opentelemetry/sdk-trace` and attach it with
`attachGlobalTracerProvider()`.

### `@arizeai/phoenix-client` experiments

A `tracerProvider` passed to `evaluateExperiment()` must be a `TracerProvider` from `@opentelemetry/sdk-trace`.
