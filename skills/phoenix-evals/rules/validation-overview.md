# Validation: Overview

LLM judges can be confidently wrong. Always validate before deploying.

## Validation Process

1. **Create golden dataset** - 100+ examples with human labels
2. **Run evaluator** - Get predictions on same examples
3. **Compare** - Measure agreement (accuracy, TPR, TNR)
4. **Iterate** - Improve until >80% agreement

## Minimum Requirements

| Requirement | Target |
| ----------- | ------ |
| Test set size | 100+ examples |
| Balance | ~50/50 pass/fail |
| Accuracy | >80% (matches human agreement) |
| TPR/TNR | Both >70% |

## Quick Validation

```python
from sklearn.metrics import classification_report

# Compare evaluator predictions to human labels
print(classification_report(human_labels, evaluator_predictions))
# Target: >80% agreement
```

## When to Re-Validate

- After changing prompt template
- After switching judge model
- After criteria changes
- Monthly (recommended)

## Warning Signs

- All pass or all fail → evaluator too lenient/strict
- Random results → criteria unclear
- Disagrees with your intuition → needs investigation

**See Also:** [validation-human-calibration-python](validation-human-calibration-python.md) or [validation-human-calibration-typescript](validation-human-calibration-typescript.md) for detailed calibration process.
