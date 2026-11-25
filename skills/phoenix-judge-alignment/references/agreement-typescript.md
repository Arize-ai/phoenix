# Measure judge agreement in TypeScript

To assess a judge as it is, compare the verdicts it already logged with the human
labels on every labeled record, as in [labels-typescript](labels-typescript.md).
The counting below is the same. To improve a judge, run it as the experiment task on the
tuning split of a labeled dataset, then compare its labels with the human labels in
each example's reference output.

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { getDatasetExamples } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";

const client = createClient();
const dataset = { datasetName: "reviewer-verdicts-2026-11", splits: ["dev"] };

const HUMAN_FAIL_LABELS = new Set(["fail", "bad"]);
const JUDGE_FAIL_LABELS = new Set(["violates"]);

const task: ExperimentTask = async (example) => {
  const result = await judge.evaluate({
    input: String(example.input.question),
    output: String(example.input.answer),
  });
  return { label: result.label ?? null, explanation: result.explanation ?? null };
};

const experiment = await runExperiment({
  client,
  dataset,
  task,
  experimentName: "judge-v2-dev",
});

// Experiment runs refer to examples by nodeId.
const { examples } = await getDatasetExamples({ client, dataset });
const humanLabel = new Map(
  examples.map((example) => [example.nodeId ?? example.id, String(example.output?.humanLabel ?? "")])
);

let tp = 0, fn = 0, fp = 0, tn = 0, unscored = 0;
for (const run of Object.values(experiment.runs)) {
  const output = run.output as { label: string | null } | null;
  const human = humanLabel.get(run.datasetExampleId);
  if (run.error || !output?.label || !human) {
    unscored++;
    continue;
  }
  const humanFail = HUMAN_FAIL_LABELS.has(human);
  const judgeFail = JUDGE_FAIL_LABELS.has(output.label);
  if (humanFail && judgeFail) tp++;
  else if (humanFail) fn++;
  else if (judgeFail) fp++;
  else tn++;
}

console.log({
  recall: tp + fn ? tp / (tp + fn) : null,
  falsePositiveRate: fp + tn ? fp / (fp + tn) : null,
  precision: tp + fp ? tp / (tp + fp) : null,
  counts: { tp, fn, fp, tn, unscored },
});
```

- Join runs to examples on `nodeId`: `run.datasetExampleId` holds the Phoenix ID,
  which differs from `example.id` when examples have user-provided IDs.
- Report the counts with the rates, and the runs that couldn't be scored.
- Read the misses (`humanFail && !judgeFail`) and wrong flags (`!humanFail &&
  judgeFail`) with the judge's explanations before changing the rubric.
- When tuning, use the `dev` split. Run the `test` split once, with the final
  rubric, and report that result.

The Python reference, [agreement-python](agreement-python.md), has the interval and
production-rate correction formulas. They're plain arithmetic and port directly.
