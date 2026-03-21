# Production: Continuous Evaluation

Capability vs regression evals and the ongoing feedback loop.

## Two Types of Evals

| Type | Pass Rate Target | Purpose | Update |
| ---- | ---------------- | ------- | ------ |
| **Capability** | 50-80% | Measure improvement | Add harder cases |
| **Regression** | 95-100% | Catch breakage | Add fixed bugs |

## Saturation

When capability evals hit >95% pass rate, they're saturated:
1. Graduate passing cases to regression suite
2. Add new challenging cases to capability suite

## Feedback Loop

```
Production → Sample traffic → Run evaluators → Find failures
    ↑                                              ↓
Deploy  ←  Run CI evals  ←  Create test cases  ←  Error analysis
```

## Implementation

Build a continuous monitoring loop:

1. **Sample recent traces** at regular intervals (e.g., 100 traces per hour)
2. **Run evaluators** on sampled traces
3. **Log results** to Phoenix for tracking
4. **Queue concerning results** for human review
5. **Create test cases** from recurring failure patterns

```python
from phoenix.client import Client
from datetime import datetime, timedelta

client = Client()

# 1. Sample recent spans (includes full attributes for evaluation)
spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-app",
    start_time=datetime.now() - timedelta(hours=1),
    root_spans_only=True,
    limit=100,
)

# 2. Run evaluators
from phoenix.evals import async_evaluate_dataframe

results_df = await async_evaluate_dataframe(
    dataframe=spans_df,
    evaluators=[quality_eval, safety_eval],
    concurrency=5,
)

# 3. Upload results as annotations
from phoenix.evals.utils import to_annotation_dataframe

annotations_df = to_annotation_dataframe(results_df)
client.spans.log_span_annotations_dataframe(dataframe=annotations_df)
```

For trace-level monitoring (e.g., agent workflows), use `get_traces` to identify traces, then fetch full span data:

```python
# Identify slow traces
traces = client.traces.get_traces(
    project_identifier="my-app",
    start_time=datetime.now() - timedelta(hours=1),
    sort="latency_ms",
    order="desc",
    limit=50,
)
# traces contain: trace_id, start_time, end_time, and spans (metadata only)
```

## Alerting

| Condition | Severity | Action |
| --------- | -------- | ------ |
| Regression < 98% | Critical | Page oncall |
| Capability declining | Warning | Slack notify |
| Capability > 95% for 7d | Info | Schedule review |

## Key Principles

- **Two suites** - Capability + Regression always
- **Graduate cases** - Move consistent passes to regression
- **Track trends** - Monitor over time, not just snapshots
