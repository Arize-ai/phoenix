# Phoenix Tracing: Production Guide (Python)

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

## 5. Production Checklist

- [ ] Batch processing enabled
- [ ] Data masking configured (`HIDE_INPUTS`/`HIDE_OUTPUTS` if PII)
- [ ] Span filtering for health checks/noisy paths
- [ ] Error handling implemented
- [ ] Graceful degradation if Phoenix unavailable
- [ ] Performance tested
- [ ] Monitoring configured (Phoenix UI checked)
