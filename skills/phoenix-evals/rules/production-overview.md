# Production: Overview

CI/CD evals vs production monitoring - complementary approaches.

## Two Evaluation Modes

| Aspect | CI/CD Evals | Production Monitoring |
| ------ | ----------- | -------------------- |
| **When** | Pre-deployment | Post-deployment, ongoing |
| **Data** | Fixed dataset | Sampled traffic |
| **Goal** | Prevent regression | Detect drift |
| **Response** | Block deploy | Alert & analyze |

## CI/CD Evaluations

```python
# Fast, deterministic checks
ci_evaluators = [
    has_required_format,
    no_pii_leak,
    safety_check,
    regression_test_suite,
]

# Small but representative dataset (~100 examples)
run_experiment(ci_dataset, task, ci_evaluators)
```

Set thresholds: regression=0.95, safety=1.0, format=0.98.

## Production Monitoring

```python
# Async LLM judges on sampled traffic
def monitor_production():
    traces = sample_recent_traces(n=100, period="1h")
    for trace in traces:
        results = run_evaluators_async(trace, production_evaluators)
        if any(r["score"] < 0.5 for r in results):
            alert_on_failure(trace, results)
```

Prioritize: errors → negative feedback → random sample.

## Feedback Loop

```
Production finds failure → Error analysis → Add to CI dataset → Prevents future regression
```

**See Also:** [production-continuous](production-continuous.md) for capability vs regression evals.
