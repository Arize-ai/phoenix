# Validation: Measuring Eval Quality

Metrics for evaluating your evaluators.

## Core Metrics

| Metric | Formula | Measures |
| ------ | ------- | -------- |
| **Accuracy** | (TP+TN) / Total | Overall correctness |
| **TPR (Recall)** | TP / (TP+FN) | Catching actual positives |
| **TNR (Specificity)** | TN / (TN+FP) | Catching actual negatives |
| **Precision** | TP / (TP+FP) | Positive prediction accuracy |
| **F1** | 2×(P×R)/(P+R) | Balance of precision/recall |
| **Cohen's Kappa** | Agreement beyond chance | Comparing evaluators |

## Quick Calculation

```python
from sklearn.metrics import classification_report, cohen_kappa_score

print(classification_report(human_labels, evaluator_labels))
print(f"Kappa: {cohen_kappa_score(human_labels, evaluator_labels):.3f}")
```

## Which to Optimize?

| Scenario | Optimize | Reason |
| -------- | -------- | ------ |
| Safety-critical | High TNR | Don't miss failures |
| Quality assurance | High TPR | Don't miss successes |
| Balanced | F1 | Balance both |
| Comparing evals | Kappa | Beyond chance |

## Thresholds

| Metric | Minimum | Target |
| ------ | ------- | ------ |
| Accuracy | 70% | 80%+ |
| TPR/TNR | 70% | 80%+ |
| Cohen's Kappa | 0.50 | 0.70+ |

## Kappa Interpretation

| Kappa | Agreement |
| ----- | --------- |
| < 0.20 | Poor |
| 0.21-0.40 | Fair |
| 0.41-0.60 | Moderate |
| 0.61-0.80 | Substantial |
| 0.81-1.00 | Almost perfect |
