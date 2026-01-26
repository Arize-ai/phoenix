# Validation: Human Calibration

Calibrating LLM judges against human annotations.

## Key Metrics

| Metric | Formula | Target |
| ------ | ------- | ------ |
| TPR (Recall) | TP / (TP + FN) | >80% |
| TNR (Specificity) | TN / (TN + FP) | >80% |
| Accuracy | (TP + TN) / Total | >80% |

## Calibration Process

```python
from sklearn.metrics import classification_report, confusion_matrix

# 1. Create balanced test set (100+ examples, ~50/50 pass/fail)
# 2. Get human labels
# 3. Run evaluator
# 4. Compare

print(classification_report(human_labels, evaluator_predictions))

cm = confusion_matrix(human_labels, evaluator_predictions)
tn, fp, fn, tp = cm.ravel()
tpr = tp / (tp + fn)
tnr = tn / (tn + fp)
```

## Analyze Errors

Find and review misclassified examples:
- **False Positives**: Evaluator says pass, human says fail
- **False Negatives**: Evaluator says fail, human says pass

Improve prompt based on error patterns.

## Correct Estimates

Use TPR/TNR to correct production metrics:

```python
def correct_estimate(observed, tpr, tnr):
    return (observed - (1 - tnr)) / (tpr - (1 - tnr))
```

## Schedule

| When | Action |
| ---- | ------ |
| Initial | 100+ examples before deploy |
| Monthly | Full re-calibration |
| After changes | Re-calibrate affected examples |

## Red Flags

- TPR or TNR < 70%
- Large gap between TPR and TNR
- Cohen's Kappa < 0.6 (if multiple annotators)
