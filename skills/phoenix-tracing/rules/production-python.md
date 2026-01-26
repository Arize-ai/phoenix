# Phoenix Tracing: Production Guide (Python)

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

**Python override:**

```python
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from phoenix.otel import register

tracer_provider = register(
    project_name="my-app",
    batch_span_processor=BatchSpanProcessor(...)  # Custom config
)
```

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

**Python TraceConfig:**

```python
from phoenix.otel import register
from openinference.instrumentation import TraceConfig

config = TraceConfig(
    hide_inputs=True,
    hide_outputs=True,
    hide_input_messages=True
)
register(trace_config=config)
```

**Precedence:** Code > Environment variables > Defaults

---

## 3. Span Filtering

**Suppress specific code blocks:**

```python
from phoenix.otel import suppress_tracing

with suppress_tracing():
    internal_logging()  # No spans generated
```

**Custom SpanProcessor (advanced):**

```python
from opentelemetry.sdk.trace import SpanProcessor

class FilterSpanProcessor(SpanProcessor):
    def on_end(self, span):
        if span.attributes.get("http.route") == "/health":
            return  # Drop span
        self.exporter.export([span])
```

**Sampling:**

```bash
export OTEL_TRACES_SAMPLER="parentbased_traceidratio"
export OTEL_TRACES_SAMPLER_ARG="0.1"  # Sample 10%
```

---

## 4. Error Handling

```python
from opentelemetry.trace import Status, StatusCode

with tracer.start_as_current_span("operation") as span:
    try:
        result = risky_operation()
        span.set_status(Status(StatusCode.OK))
    except Exception as e:
        span.record_exception(e)
        span.set_status(Status(StatusCode.ERROR))
        raise
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
