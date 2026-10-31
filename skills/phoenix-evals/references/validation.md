# Validation

Validate LLM judges against human labels before deploying. Target >80% agreement.

This page covers what to compute and the targets to hit. Runnable code is in
`validation-evaluators-{python|typescript}.md`.

## Requirements

| Requirement | Target |
| ----------- | ------ |
| Test set size | 100+ examples |
| Balance | ~50/50 pass/fail |
| Accuracy | >80% |
| TPR/TNR | Both >70% |

## Metrics

| Metric | Formula | Use When |
| ------ | ------- | -------- |
| **Accuracy** | (TP+TN) / Total | General |
| **TPR (Recall)** | TP / (TP+FN) | Quality assurance |
| **TNR (Specificity)** | TN / (TN+FP) | Safety-critical |
| **Cohen's Kappa** | Agreement beyond chance | Comparing evaluators |

## Human Agreement Is the Ceiling

Human labels are not perfect ground truth — labelers disagree. When two or more people label
the same examples, **their agreement with each other is the ceiling** the judge is measured
against: a judge cannot be expected to agree with the labels more often than the labelers agree
with one another.

- Compute inter-annotator agreement (raw agreement rate, or Cohen's kappa for two labelers) and
  treat *that* as the target the judge is approaching, not 100%.
- Where labelers disagree, the "true" label is itself uncertain — adjudicate it to a single gold
  label or drop the example before scoring the judge; never count the judge "wrong" on an
  example the humans themselves split on.
- If inter-annotator agreement is low, the criteria are unclear — fix the labeling guidelines
  before trusting any judge number.

## Quick Validation

Requires scikit-learn, which no Phoenix package installs: `pip install scikit-learn`.

```python
from sklearn.metrics import classification_report, confusion_matrix, cohen_kappa_score

print(classification_report(human_labels, evaluator_predictions))
print(f"Kappa: {cohen_kappa_score(human_labels, evaluator_predictions):.3f}")

# Get TPR/TNR
cm = confusion_matrix(human_labels, evaluator_predictions)
tn, fp, fn, tp = cm.ravel()
tpr = tp / (tp + fn)
tnr = tn / (tn + fp)
```

## Inspect the Errors, Not Just the Score

An aggregate accuracy or TPR/TNR number tells you *how often* the judge disagrees with humans,
never *why*. Always pull out the disagreements and read a handful of each:

- **False positives** — judge says pass, humans say fail (the judge is too lenient).
- **False negatives** — judge says fail, humans say pass (the judge is too strict).

Reading them tells you whether the judge is miscalibrated, the prompt is ambiguous, or the
labels themselves are wrong — and that is what drives the next prompt revision.
`validation-evaluators-{python|typescript}.md` has the code to isolate these cases (`fp_mask` /
`fn_mask`) and to correct an observed production pass rate for known TPR/TNR (`correct_estimate`).

## Golden Dataset Structure

```python
golden_example = {
    "input": "What is the capital of France?",
    "output": "Paris is the capital.",
    "ground_truth_label": "correct",
}
```

## Building Golden Datasets

1. Sample production traces (errors, negative feedback, edge cases)
2. Balance ~50/50 pass/fail
3. Expert labels each example
4. Version datasets (never modify existing)

```python
# GOOD - create new version
golden_v2 = golden_v1 + [new_examples]

# BAD - never modify existing
golden_v1.append(new_example)
```

## Warning Signs

- All pass or all fail → too lenient/strict
- Random results → criteria unclear
- TPR/TNR < 70% → needs improvement

## Re-Validate When

- Prompt template changes
- Judge model changes
- Criteria changes
- Monthly

## See Also

- [validation-evaluators-python](validation-evaluators-python.md), [validation-evaluators-typescript](validation-evaluators-typescript.md)
