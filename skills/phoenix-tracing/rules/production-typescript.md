# Phoenix Tracing: Production Guide (TypeScript)

**CRITICAL: Configure batching, data masking, and span filtering for production deployment.**

## 1. Batch Processing

**Enable batch processing for production efficiency.** Batching reduces network overhead by sending spans in groups rather than individually.

Configure via OpenTelemetry environment variables if needed:
```bash
export OTEL_BSP_SCHEDULE_DELAY=5000           # Batch interval
export OTEL_BSP_MAX_QUEUE_SIZE=2048           # Queue size
export OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512     # Batch size
```

See [OpenTelemetry docs](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/) for details.

---

## 2. Data Masking (PII Protection)

**Environment variables:**

```bash
export OPENINFERENCE_HIDE_INPUTS=true          # Hide input.value
export OPENINFERENCE_HIDE_OUTPUTS=true         # Hide output.value
export OPENINFERENCE_HIDE_INPUT_MESSAGES=true  # Hide LLM input messages
export OPENINFERENCE_HIDE_OUTPUT_MESSAGES=true # Hide LLM output messages
export OPENINFERENCE_HIDE_INPUT_IMAGES=true    # Hide image content
export OPENINFERENCE_HIDE_INPUT_TEXT=true      # Hide embedding text
export OPENINFERENCE_BASE64_IMAGE_MAX_LENGTH=10000  # Limit image size
```

**TypeScript TraceConfig:**

```typescript
import { register } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

const traceConfig = {
  hideInputs: true,
  hideOutputs: true,
  hideInputMessages: true
};

const instrumentation = new OpenAIInstrumentation({ traceConfig });
```

**Precedence:** Code > Environment variables > Defaults

---

## 3. Span Filtering

**Suppress specific code blocks:**

```typescript
import { suppressTracing } from "@opentelemetry/core";
import { context } from "@opentelemetry/api";

await context.with(suppressTracing(context.active()), async () => {
  internalLogging(); // No spans generated
});
```

**Sampling:**

```bash
export OTEL_TRACES_SAMPLER="parentbased_traceidratio"
export OTEL_TRACES_SAMPLER_ARG="0.1"  # Sample 10%
```

---

## 4. Error Handling

```typescript
import { SpanStatusCode } from "@opentelemetry/api";

try {
  result = await riskyOperation();
  span?.setStatus({ code: SpanStatusCode.OK });
} catch (e) {
  span?.recordException(e);
  span?.setStatus({ code: SpanStatusCode.ERROR });
  throw e;
}
```

---

## 5. Production Checklist

- [ ] Batch processing enabled
- [ ] Data masking configured (`HIDE_INPUTS`/`HIDE_OUTPUTS` if PII)
- [ ] Span filtering for health checks/noisy paths
- [ ] Error handling implemented
- [ ] Graceful degradation if Phoenix unavailable
- [ ] Performance tested
- [ ] Monitoring configured (Phoenix UI checked)
