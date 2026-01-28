# Validation: Calibration (TypeScript)

Calibrate LLM judges against human labels. Target >80% TPR/TNR/Accuracy.

## Calculate Metrics

```typescript
interface CalibrationMetrics {
  tp: number; tn: number; fp: number; fn: number;
  tpr: number; tnr: number; accuracy: number;
}

function calculateMetrics(human: boolean[], pred: boolean[]): CalibrationMetrics {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < human.length; i++) {
    if (human[i] && pred[i]) tp++;
    else if (!human[i] && !pred[i]) tn++;
    else if (!human[i] && pred[i]) fp++;
    else fn++;
  }
  return {
    tp, tn, fp, fn,
    tpr: tp / (tp + fn) || 0,
    tnr: tn / (tn + fp) || 0,
    accuracy: (tp + tn) / (tp + tn + fp + fn) || 0,
  };
}
```

## Correct Production Estimates

```typescript
function correctEstimate(observed: number, tpr: number, tnr: number): number {
  return (observed - (1 - tnr)) / (tpr - (1 - tnr));
}
```

## Find Misclassified

```typescript
function findMisclassified<T>(examples: T[], human: boolean[], pred: boolean[]) {
  const fp: T[] = [], fn: T[] = [];
  for (let i = 0; i < examples.length; i++) {
    if (pred[i] && !human[i]) fp.push(examples[i]);
    if (!pred[i] && human[i]) fn.push(examples[i]);
  }
  return { falsePositives: fp, falseNegatives: fn };
}
```

## Red Flags

- TPR or TNR < 70%
- Large gap between TPR and TNR
- Kappa < 0.6
