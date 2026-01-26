# Validation: Human Calibration (TypeScript)

Calibrating LLM judges against human annotations.

## Key Metrics

| Metric | Formula | Target |
| ------ | ------- | ------ |
| TPR (Recall) | TP / (TP + FN) | >80% |
| TNR (Specificity) | TN / (TN + FP) | >80% |
| Accuracy | (TP + TN) / Total | >80% |

## Calibration Process

```typescript
interface CalibrationMetrics {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  tpr: number;
  tnr: number;
  accuracy: number;
}

function calculateMetrics(humanLabels: boolean[], predictions: boolean[]): CalibrationMetrics {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;

  for (let i = 0; i < humanLabels.length; i++) {
    const actual = humanLabels[i];
    const predicted = predictions[i];

    if (actual && predicted) tp++;
    else if (!actual && !predicted) tn++;
    else if (!actual && predicted) fp++;
    else fn++;
  }

  const tpr = tp / (tp + fn) || 0;
  const tnr = tn / (tn + fp) || 0;
  const accuracy = (tp + tn) / (tp + tn + fp + fn) || 0;

  return { tp, tn, fp, fn, tpr, tnr, accuracy };
}

// Usage
const metrics = calculateMetrics(humanLabels, evaluatorPredictions);
console.log(`TPR: ${metrics.tpr.toFixed(2)}, TNR: ${metrics.tnr.toFixed(2)}`);
```

## Analyze Errors

Find and review misclassified examples:

```typescript
function findMisclassified(
  examples: Example[],
  humanLabels: boolean[],
  predictions: boolean[]
): { falsePositives: Example[]; falseNegatives: Example[] } {
  const falsePositives: Example[] = [];
  const falseNegatives: Example[] = [];

  for (let i = 0; i < examples.length; i++) {
    if (predictions[i] && !humanLabels[i]) falsePositives.push(examples[i]);
    if (!predictions[i] && humanLabels[i]) falseNegatives.push(examples[i]);
  }

  return { falsePositives, falseNegatives };
}
```

- **False Positives**: Evaluator says pass, human says fail
- **False Negatives**: Evaluator says fail, human says pass

Improve prompt based on error patterns.

## Correct Estimates

Use TPR/TNR to correct production metrics:

```typescript
function correctEstimate(observed: number, tpr: number, tnr: number): number {
  return (observed - (1 - tnr)) / (tpr - (1 - tnr));
}
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
