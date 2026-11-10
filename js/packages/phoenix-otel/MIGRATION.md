# Migrations

## v2.x to v3.0.0

Version 3 moves to OpenTelemetry JS 3 (`@opentelemetry/sdk-trace` 3.x, `@opentelemetry/api` 1.10).

### Requirements

- Node.js 22.15 or newer.
- Use OpenTelemetry JS 3 packages in your app. Instrumentations must be compatible with
  `@opentelemetry/instrumentation` 0.301.

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

### `OTEL_*` environment variables

OpenTelemetry JS 3 no longer reads `OTEL_TRACES_SAMPLER`, `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*`, or `OTEL_BSP_*` in
the SDK. `register()` still applies them, so no change is needed when you use the default processor.
`OTEL_BSP_*` does not apply to processors you pass in `spanProcessors`. Set the batch options on the processor
instead.

### `@arizeai/phoenix-client` experiments

A `tracerProvider` passed to `evaluateExperiment()` must be an `@opentelemetry/sdk-trace` 3.x `TracerProvider`.
