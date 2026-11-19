# Compare experiments

A comparison answers one question: on the same examples, scored the same way, does
the candidate do better than the baseline by more than the runs disagree with
themselves?

## Before you compare

- **Same dataset version and split.** Check `dataset_id` and `dataset_version_id` on
  both experiments. Different examples make the comparison meaningless.
- **Same evaluators.** Compare only evaluator names both experiments have. A metric
  only one side has can't decide anything.
- **Count what's missing.** Task errors and evaluator errors have no score. Report
  them per experiment; a candidate that errors more often isn't better because its
  surviving runs score well.
- **Know what "pass" means for each evaluator.** Usually a score of 1, or a label
  such as `pass` or `correct`. Respect `direction`: for a `minimize` evaluator, 0 is
  the pass.

## Compute pass rates

```python
from collections import defaultdict

from phoenix.client import Client

client = Client()


def runs_by_evaluator(experiment_id: str) -> dict[str, list[dict]]:
    """Returns evaluator name -> one row per task run with its example, repetition, and score.

    A run with no recorded evaluation (the task or the evaluator failed) gets a row with
    score None, so it counts as an error instead of disappearing.
    """
    experiment = client.experiments.get_experiment(experiment_id=experiment_id)
    evaluations = {
        (evaluation.experiment_run_id, evaluation.name): evaluation
        for evaluation in experiment["evaluation_runs"]
    }
    names = {name for _, name in evaluations}
    rows: dict[str, list[dict]] = defaultdict(list)
    for run in experiment["task_runs"]:
        for name in names:
            evaluation = evaluations.get((run["id"], name))
            result = evaluation.result if evaluation and isinstance(evaluation.result, dict) else None
            rows[name].append(
                {
                    "example_id": run["dataset_example_id"],
                    "repetition": run["repetition_number"],
                    "score": result.get("score") if result else None,
                    "label": result.get("label") if result else None,
                    "error": run.get("error") or (evaluation.error if evaluation else "no evaluation"),
                }
            )
    return rows


baseline = runs_by_evaluator("BASELINE_EXPERIMENT_ID")
candidate = runs_by_evaluator("CANDIDATE_EXPERIMENT_ID")
for name in sorted(baseline.keys() & candidate.keys()):
    passed = lambda row: row["score"] >= 1.0  # adjust per evaluator and direction
    print(name, summarize(baseline[name], passed), summarize(candidate[name], passed))
```

In TypeScript, `evaluationRuns` exists only on the result `runExperiment` or
`evaluateExperiment` returns; `getExperiment` returns runs without evaluations or
repetition numbers. For a saved experiment, use the Python client or
`GET /v1/experiments/{id}/json`. From the terminal,
`px experiment get <id>` prints the runs with their evaluations.

## Compare per example

Group runs by example and count, for each evaluator:

- **k of n per example.** How many of each example's repetitions passed, on each
  side. An example that passes 3 of 3 on one side and 0 of 3 on the other moved; an
  example at 2 of 3 on both didn't.
- **Examples that improved and examples that got worse.** Count examples whose pass
  count went up and examples whose pass count went down. Read a few of each with
  their outputs and explanations.
- **Examples that pass every run.** For must-pass checks, report how many examples
  pass all repetitions on each side. One failure in three runs is an intermittent
  failure, not noise.

When the user gives no decision rule, a paired sign test over the examples that
changed tells you whether the improved-versus-worse split could be chance:

```python
from math import comb


def sign_test_p(improved: int, worse: int) -> float:
    """Returns the two-sided sign-test p-value for improved vs worse examples."""
    n = improved + worse
    if n == 0:
        return 1.0
    k = min(improved, worse)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2**n)
```

With 3 improved and 0 worse, p is 0.25: not evidence either way.

## Compare by slice

When the user names a category (a topic, a customer tier, a language), compute rates
per slice by joining runs to their examples' metadata:

```python
dataset = client.datasets.get_dataset(dataset="DATASET_NAME")
# Runs refer to examples by node_id; id is the user-provided ID when one was set.
slice_of = {example["node_id"]: example["metadata"].get("category") for example in dataset.examples}
for row in candidate["format_valid"]:
    row["slice"] = slice_of.get(row["example_id"])
```

Then summarize each slice the same way as the whole set. A slice the user calls out
can be a must-pass check on its own.

## Decide

- **When the user states a rule, apply it** to the observed numbers and give the
  call. Name the uncertainty (how many examples moved, how many runs), but don't
  replace their rule with your own threshold.
- **Must-pass checks and slices are the ones the user names.** A regression on one
  of them blocks the change. Report regressions elsewhere without letting them
  decide.
- **Without a stated rule:** call the change better when it wins on the main metric,
  more examples improved than got worse, and the split is unlikely to be chance;
  worse when it loses or errors more; otherwise not enough evidence, with what would
  settle it (more repetitions, more examples).

Report every shared evaluator with both sides' pass rates and run counts, error
counts, per-slice rates the user asked for, and the examples that moved.
