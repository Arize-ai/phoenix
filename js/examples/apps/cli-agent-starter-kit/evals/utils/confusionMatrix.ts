/* eslint-disable no-console */

/** A single (predicted, actual) label pair produced by a benchmark run. */
export type LabelPair = { predicted: string | null; actual: string };

export type ConfusionMatrix = {
  evaluatorName: string;
  positiveLabel: string;
  negativeLabel: string;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  errors: number;
  total: number;
};

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

/**
 * Tally predicted-vs-actual label pairs into a binary confusion matrix.
 *
 * A `null` prediction (the evaluator errored, or returned a label outside the
 * positive/negative pair) is counted as an error rather than a TP/FP/TN/FN.
 */
export function computeConfusionMatrix({
  evaluatorName,
  pairs,
  positiveLabel,
  negativeLabel,
}: {
  evaluatorName: string;
  pairs: LabelPair[];
  positiveLabel: string;
  negativeLabel: string;
}): ConfusionMatrix {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let errors = 0;

  for (const { predicted, actual } of pairs) {
    if (predicted === null) {
      errors++;
    } else if (actual === positiveLabel && predicted === positiveLabel) {
      tp++;
    } else if (actual === negativeLabel && predicted === positiveLabel) {
      fp++;
    } else if (actual === negativeLabel && predicted === negativeLabel) {
      tn++;
    } else if (actual === positiveLabel && predicted === negativeLabel) {
      fn++;
    } else {
      errors++;
    }
  }

  return {
    evaluatorName,
    positiveLabel,
    negativeLabel,
    tp,
    fp,
    tn,
    fn,
    errors,
    total: tp + fp + tn + fn,
  };
}

/**
 * Print a confusion matrix plus TPR / TNR / accuracy. A well-calibrated
 * evaluator should reach > 80% on all three before you trust it at scale.
 */
export function printConfusionMatrix(matrix: ConfusionMatrix): void {
  const {
    evaluatorName,
    positiveLabel,
    negativeLabel,
    tp,
    fp,
    tn,
    fn,
    errors,
    total,
  } = matrix;
  const divider = "-".repeat(60);
  const border = "=".repeat(60);

  const tpr = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const tnr = tn + fp > 0 ? (tn / (tn + fp)) * 100 : 0;
  const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;

  const predPos = `Pred: ${positiveLabel}`;
  const predNeg = `Pred: ${negativeLabel}`;
  const actPos = `Actual: ${positiveLabel}`;
  const actNeg = `Actual: ${negativeLabel}`;

  const colLabel = Math.max(actPos.length, actNeg.length) + 2;
  const colPos =
    Math.max(predPos.length, `${tp} (TP)`.length, `${fp} (FP)`.length) + 2;
  const colNeg =
    Math.max(predNeg.length, `${fn} (FN)`.length, `${tn} (TN)`.length) + 2;

  console.log("");
  console.log(border);
  console.log(`  EVALUATOR BENCHMARK: ${evaluatorName}`);
  console.log(border);
  console.log(`  Positive class:  ${positiveLabel}`);
  console.log(`  Negative class:  ${negativeLabel}`);
  console.log(`  Total examples:  ${total}`);

  console.log("");
  console.log(divider);
  console.log("  Confusion Matrix");
  console.log(divider);
  console.log(
    `  ${[padRight("", colLabel), padRight(predPos, colPos), padRight(predNeg, colNeg)].join("  ")}`
  );
  console.log(
    `  ${[padRight(actPos, colLabel), padRight(`${tp} (TP)`, colPos), padRight(`${fn} (FN)`, colNeg)].join("  ")}`
  );
  console.log(
    `  ${[padRight(actNeg, colLabel), padRight(`${fp} (FP)`, colPos), padRight(`${tn} (TN)`, colNeg)].join("  ")}`
  );

  console.log("");
  console.log(divider);
  console.log("  Metrics");
  console.log(divider);
  console.log(
    `  TPR (True Positive Rate / Sensitivity):   ${tpr.toFixed(1)}%  [${tp}/${tp + fn} positives correct]`
  );
  console.log(
    `  TNR (True Negative Rate / Specificity):   ${tnr.toFixed(1)}%  [${tn}/${tn + fp} negatives correct]`
  );
  console.log(
    `  Accuracy:                                 ${accuracy.toFixed(1)}%  [${tp + tn}/${total} correct]`
  );
  console.log(`  Errors (eval failures):                   ${errors}`);
  console.log("");
  console.log(border);
  console.log("");
}
