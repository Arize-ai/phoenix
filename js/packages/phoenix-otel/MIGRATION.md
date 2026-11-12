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
an options object. The `@arizeai/phoenix-otel` processors throw a `TypeError` when passed an exporter positionally;
the `@opentelemetry/sdk-trace` ones accept it and then drop every span.

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
`OTEL_BSP_*`. Configure them in code instead. If one is set and you did not configure the same setting in code, a warning is logged once per variable per process: `register()` checks `sampler`, each `spanLimits` field and its default batch processor, and the re-exported `BatchSpanProcessor` checks each batch option you leave out.

| Variables                                        | `register()` option                                     |
| ------------------------------------------------ | ------------------------------------------------------- |
| `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG` | `sampler`                                               |
| `OTEL_SPAN_*`, `OTEL_ATTRIBUTE_*` limits         | `spanLimits`                                            |
| `OTEL_BSP_*`                                     | a `BatchSpanProcessor` with options in `spanProcessors` |

`spanProcessors` replaces the default Phoenix exporter, so give your `OTLPTraceExporter` the Phoenix URL
and `Authorization` header yourself (see the custom span processor example in the README).

**Before:**

```bash
OTEL_TRACES_SAMPLER=parentbased_traceidratio OTEL_TRACES_SAMPLER_ARG=0.1 node app.js
```

**After:**

```ts
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  register,
} from "@arizeai/phoenix-otel";

register({
  sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(0.1) }),
  spanLimits: { attributeValueLengthLimit: 4096 },
});
```

`AlwaysOnSampler`, `AlwaysOffSampler`, `ParentBasedSampler`, and `TraceIdRatioBasedSampler` are re-exported from
`@arizeai/phoenix-otel`.

### `@arizeai/phoenix-client` experiments

A `tracerProvider` passed to `evaluateExperiment()` must be a `TracerProvider` from `@opentelemetry/sdk-trace`.
