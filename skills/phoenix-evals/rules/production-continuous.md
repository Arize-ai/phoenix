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
