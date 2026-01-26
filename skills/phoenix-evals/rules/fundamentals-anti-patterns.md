# Fundamentals: Anti-Patterns

Common mistakes that undermine evaluation efforts.

## 1. Generic Metrics Trap

**Problem:** Using pre-built "quality" or "helpfulness" scores that don't measure YOUR failure modes.

**Fix:** Build evaluators for failures discovered through error analysis.

## 2. Vibe-Based Evals

**Problem:** "It seems like it's working" - no quantification, no baselines.

**Fix:** Measure everything with experiments:
```python
baseline = run_experiment(dataset, old_prompt, evaluators)
improved = run_experiment(dataset, new_prompt, evaluators)
print(f"Improvement: {improved.pass_rate - baseline.pass_rate:+.1%}")
```

## 3. Ignoring Human Feedback

**Problem:** Assuming LLM judges are correct without calibration.

**Fix:** Always validate against human labels. Target >80% TPR/TNR.

## 4. Outsourcing Error Analysis

**Problem:** Delegating review loses product intuition.

**Fix:** Do error analysis yourself. Review 100+ traces personally.

## 5. Premature Automation

**Problem:** Building evaluators for imagined problems.

**Fix:** Let observed failures drive what you automate.

## 6. Saturation Blindness

**Problem:** 100% pass rate = no signal for improvement.

**Fix:** Keep capability evals challenging (50-80% pass). Graduate passing cases to regression suite.

## Summary

| Anti-Pattern | Fix |
| ------------ | --- |
| Generic metrics | Application-specific evaluators |
| Vibe-based | Quantify with experiments |
| Ignoring humans | Calibrate against human labels |
| Outsourcing analysis | Do it yourself |
| Premature automation | Evidence-based building |
| Saturation | Keep evals challenging |
