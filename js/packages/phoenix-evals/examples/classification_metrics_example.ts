/* eslint-disable no-console */
import {
  createF1Evaluator,
  createFBetaEvaluator,
  createPrecisionEvaluator,
  createPrecisionRecallFScoreEvaluator,
  createPrecisionRecallFScoreEvaluators,
  createRecallEvaluator,
} from "../src/code";

/**
 * Example demonstrating the built-in precision/recall/F-score code
 * evaluators in `@arizeai/phoenix-evals/code`.
 *
 * These are dataset-level (batch) metrics, not per-row evaluators: `expected`
 * and `output` are the full sequence of labels across every example you want
 * to score together, not a single row's label. Collect every row's expected
 * and predicted label first, then call `.evaluate({ expected, output })`
 * once over the full arrays.
 *
 * Background reading:
 * - Precision and recall (Wikipedia): https://en.wikipedia.org/wiki/Precision_and_recall
 * - scikit-learn `precision_recall_fscore_support` (the averaging strategies
 *   these evaluators mirror): https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_fscore_support.html
 * - Van Rijsbergen, C.J. (1979). "Information Retrieval" (2nd ed.). Butterworth-Heinemann
 *   — the origin of the F-measure and its beta parameter.
 */

async function binaryClassificationExample() {
  console.log("\n=== Binary classification: spam detection ===");

  // A spam filter's predictions for 10 emails, alongside ground truth labels.
  const expected = [
    "spam",
    "ham",
    "spam",
    "spam",
    "ham",
    "ham",
    "spam",
    "ham",
    "spam",
    "ham",
  ];
  const output = [
    "spam",
    "ham",
    "spam",
    "spam",
    "ham",
    "spam",
    "spam",
    "spam",
    "spam",
    "ham",
  ];

  // For binary classification, name the class you care about with
  // `positiveLabel`. Precision answers "of the emails we flagged as spam,
  // how many actually were?" — a false positive here means a real email
  // gets sent to the spam folder. Recall answers "of the emails that were
  // actually spam, how many did we catch?" — a false negative here means
  // spam lands in the inbox.
  const precision = createPrecisionEvaluator({ positiveLabel: "spam" });
  const recall = createRecallEvaluator({ positiveLabel: "spam" });
  const f1 = createF1Evaluator({ positiveLabel: "spam" });

  const [precisionResult, recallResult, f1Result] = await Promise.all([
    precision.evaluate({ expected, output }),
    recall.evaluate({ expected, output }),
    f1.evaluate({ expected, output }),
  ]);

  console.log("precision:", precisionResult.score?.toFixed(3)); // 0.714
  console.log("recall:", recallResult.score?.toFixed(3)); // 1.000
  console.log("f1:", f1Result.score?.toFixed(3)); // 0.833

  // This filter over-flags (2 false positives, 0 false negatives), so
  // recall (1.0) is already higher than precision (0.714). If missing real
  // spam is worse than the occasional false positive, weight recall more
  // heavily with beta > 1 — F2 (below) weights recall twice as much as
  // precision, pulling the score toward recall (0.926, above the F1 of
  // 0.833). Conversely, beta < 1 (e.g. F0.5) would weight precision more —
  // useful when incorrectly flagging a legitimate email is the costlier
  // mistake.
  const f2 = createFBetaEvaluator({ beta: 2, positiveLabel: "spam" });
  const f2Result = await f2.evaluate({ expected, output });
  console.log("f2 (recall-weighted):", f2Result.score?.toFixed(3)); // 0.926
}

async function multiClassAveragingExample() {
  console.log("\n=== Multi-class classification: averaging strategies ===");

  // An imbalanced 3-class dataset: "cat" dominates, "bird" is rare.
  const expected = ["cat", "cat", "cat", "cat", "dog", "dog", "bird"];
  const output = ["cat", "cat", "cat", "dog", "dog", "cat", "bird"];

  // "macro": average each class's score with equal weight, regardless of
  // how many examples that class has. A model that nails the rare "bird"
  // class but struggles on the common "cat" class scores well here — good
  // for surfacing whether minority classes are being ignored.
  const macro = createPrecisionRecallFScoreEvaluators({ average: "macro" });

  // "weighted": like macro, but each class's score is weighted by its
  // support (how often it actually occurs). Dominant classes drive the
  // result more — good when overall performance matters more than parity
  // across classes.
  const weighted = createPrecisionRecallFScoreEvaluators({
    average: "weighted",
  });

  // "micro": pool every true/false positive and false negative across all
  // classes before computing a single precision/recall/F-score. For
  // single-label multi-class problems (each example has exactly one
  // predicted and one expected label, as here), micro-averaged precision,
  // recall, and F1 are all equal to overall accuracy.
  const micro = createPrecisionRecallFScoreEvaluators({ average: "micro" });

  for (const [name, evaluators] of Object.entries({ macro, weighted, micro })) {
    const [precisionResult, recallResult, fScoreResult] = await Promise.all([
      evaluators.precision.evaluate({ expected, output }),
      evaluators.recall.evaluate({ expected, output }),
      evaluators.fScore.evaluate({ expected, output }),
    ]);
    console.log(
      `${name}: precision=${precisionResult.score?.toFixed(3)} ` +
        `recall=${recallResult.score?.toFixed(3)} ` +
        `f1=${fScoreResult.score?.toFixed(3)}`
    );
  }
}

async function composedEvaluatorExample() {
  console.log("\n=== Composed evaluator: all three metrics at once ===");

  // If you'd rather have a single evaluator that returns precision, recall,
  // and F-score together (the TypeScript analog of Python's
  // `PrecisionRecallFScore`), use `createPrecisionRecallFScoreEvaluator`
  // (singular). The headline `score` is the F-beta — the single number that
  // combines precision and recall — and the full breakdown is on `metadata`.
  const evaluator = createPrecisionRecallFScoreEvaluator();
  const result = await evaluator.evaluate({
    expected: ["cat", "dog", "cat", "bird", "dog"],
    output: ["cat", "cat", "cat", "bird", "dog"],
  });

  console.log("score (f1):", result.score?.toFixed(3)); // 0.822
  console.log("explanation:", result.explanation);
  // precision=0.888889, recall=0.833333, f1=0.822222
  console.log("metadata:", result.metadata);
  // { precision: 0.888..., recall: 0.833..., fScore: 0.822..., beta: 1, ... }
}

async function main() {
  await binaryClassificationExample();
  await multiClassAveragingExample();
  await composedEvaluatorExample();
}

main().catch(console.error);
