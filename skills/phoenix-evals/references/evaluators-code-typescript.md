# Evaluators: Code Evaluators in TypeScript

Deterministic evaluators without LLM. Fast, cheap, reproducible.

## Basic Pattern

```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

const containsCitation = createEvaluator<{ output: string }>(
  ({ output }) => /\[\d+\]/.test(output) ? 1 : 0,
  { name: "contains_citation", kind: "CODE" }
);
```

## With Full Results (asExperimentEvaluator)

```typescript
import { asExperimentEvaluator } from "@arizeai/phoenix-client/experiments";

const jsonValid = asExperimentEvaluator({
  name: "json_valid",
  kind: "CODE",
  evaluate: async ({ output }) => {
    try {
      JSON.parse(String(output));
      return { score: 1.0, label: "valid_json" };
    } catch (e) {
      return { score: 0.0, label: "invalid_json", explanation: String(e) };
    }
  },
});
```

## Parameter Types

```typescript
interface EvaluatorParams {
  input: Record<string, unknown>;
  output: unknown;
  expected: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

## Common Patterns

- **Regex**: `/pattern/.test(output)`
- **JSON**: `JSON.parse()` + zod schema
- **Keywords**: `output.includes(keyword)`
- **Similarity**: `fastest-levenshtein`

## Built-In Classification Metrics (precision/recall/F-score)

`@arizeai/phoenix-evals/code` provides precision, recall, and F-beta (including F1) as built-in dataset-level evaluators, mirroring Python's `PrecisionRecallFScore`. `expected`/`output` are the full label sequence across a batch, not a single row.

```typescript
import {
  createPrecisionEvaluator,
  createRecallEvaluator,
  createF1Evaluator,
  createFBetaEvaluator,
  createPrecisionRecallFScoreEvaluators,
} from "@arizeai/phoenix-evals/code";

// Binary classification via positiveLabel (or auto-detected for numeric {0,1}
// labels under the default "macro" average)
const precision = createPrecisionEvaluator({ positiveLabel: "spam" });
const recall = createRecallEvaluator({ positiveLabel: "spam" });

// Multi-class: average is "macro" (default, equal weight per class),
// "micro" (pool TP/FP/FN first — equals accuracy for single-label
// multi-class), or "weighted" (weight by class support)
const { precision: p, recall: r, fScore: f } =
  createPrecisionRecallFScoreEvaluators({ average: "weighted" });

// F-beta: beta > 1 weights recall more (e.g. medical screening), beta < 1
// weights precision more (e.g. spam filtering); beta = 1 is F1
const f2 = createFBetaEvaluator({ beta: 2 });

const result = await createF1Evaluator().evaluate({
  expected: ["cat", "dog", "cat", "bird"],
  output: ["cat", "cat", "cat", "bird"],
});
// { score: 0.6 }
```

Docs: [Precision / Recall / F-Score](https://arize.com/docs/phoenix/evaluation/pre-built-metrics/precision-recall-fscore).
