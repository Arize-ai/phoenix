# Phoenix Tracing: Production Guide (TypeScript)

**CRITICAL: Batch processing, data masking, span filtering for production deployment.**

## 1. Batch Span Processing (MOST IMPORTANT)

Phoenix enables `BatchSpanProcessor` by default for production efficiency.

**Configuration (OpenTelemetry standard):**

```bash
export OTEL_BSP_SCHEDULE_DELAY=5000           # Batch every 5s
export OTEL_BSP_MAX_QUEUE_SIZE=2048           # Queue up to 2048 spans
export OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512     # Send 512 spans/batch
export OTEL_BSP_EXPORT_TIMEOUT=30000          # Export timeout 30s
```

**Link:** https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/

**When to adjust:**

- High volume (>10k spans/min): Increase `MAX_QUEUE_SIZE` to 4096
- Low latency needs: Decrease `SCHEDULE_DELAY` to 1000
- Network issues: Increase `EXPORT_TIMEOUT` to 60000

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

## 5. Performance

**Span creation overhead:** ~1-5µs per span (negligible)
**Network overhead:** Minimal with batch processing (~1-2% app time)
**Memory overhead:** ~2-10MB per 2048 spans queued

**Reduce memory:**

```bash
export OTEL_BSP_MAX_QUEUE_SIZE=1024
```

---

## 6. Production Checklist

- [ ] Batch processing enabled (default)
- [ ] Batch config tuned for workload
- [ ] Data masking configured (`HIDE_INPUTS`/`HIDE_OUTPUTS` if PII)
- [ ] Span filtering for health checks/noisy paths
- [ ] Error handling implemented
- [ ] Graceful degradation if Phoenix unavailable
- [ ] Performance tested (<2% latency impact)
- [ ] Monitoring configured (Phoenix UI checked)

---
