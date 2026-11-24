# Measure judge agreement in Python

## Split the labeled records when tuning

To assess a judge as it is, skip this section and compare its logged verdicts with
the human labels on every labeled record. To improve a judge, split once, before
reading any judge output, and keep failures in both parts:

```python
import pandas as pd

labeled["human_fail"] = labeled["result.label"].map(lambda label: label in HUMAN_FAIL_LABELS)

test = labeled.groupby("human_fail", group_keys=False).sample(frac=1 / 3, random_state=7)
dev = labeled.drop(test.index)
```

`HUMAN_FAIL_LABELS` is the set of human labels that mean failure, such as
`{"fail", "bad"}`. Tune the judge on `dev`. Score `test` only when the rubric is
final. If the labels come from a dataset, assign splits there instead. The
phoenix-experiments skill covers dataset splits.

## Run the judge on the same records

Give the judge exactly the inputs it will get in production:

```python
from phoenix.evals import async_evaluate_dataframe

judge_inputs = pd.DataFrame(
    {
        "input": spans_df.loc[dev.index, "attributes.input.value"],
        "output": spans_df.loc[dev.index, "attributes.output.value"],
    },
    index=dev.index,
)
judged = await async_evaluate_dataframe(dataframe=judge_inputs, evaluators=[judge], exit_on_error=False)
judge_labels = judged[f"{judge.name}_score"].apply(lambda s: s.get("label") if isinstance(s, dict) else None)
```

Count the records the judge couldn't score, `judge_labels.isna()`, and report them.
Don't drop them silently.

## Compute the rates

```python
def agreement(human_fail: pd.Series, judge_fail: pd.Series) -> dict:
    """Returns confusion counts and rates, with failure as the positive class."""
    both = pd.DataFrame({"human": human_fail, "judge": judge_fail}).dropna()
    tp = int((both.human & both.judge).sum())
    fn = int((both.human & ~both.judge).sum())
    fp = int((~both.human & both.judge).sum())
    tn = int((~both.human & ~both.judge).sum())
    return {
        "failures": tp + fn,
        "passes": fp + tn,
        "recall": tp / (tp + fn) if tp + fn else None,
        "false_positive_rate": fp / (fp + tn) if fp + tn else None,
        "precision": tp / (tp + fp) if tp + fp else None,
        "false_discovery_share": fp / (tp + fp) if tp + fp else None,
        "counts": {"tp": tp, "fn": fn, "fp": fp, "tn": tn},
    }


# Unscored rows stay missing instead of counting as passes.
judge_fail = judge_labels.isin(JUDGE_FAIL_LABELS).astype("boolean").where(judge_labels.notna())
print(agreement(dev["human_fail"], judge_fail))
```

Report counts with the rates: "caught 14 of 16 failures (88%); of its 20 flags, 6
were good answers (30%)" says more than "recall 0.88". Note the two denominators: 6
of 20 flags is a 30% false-discovery share, while 6 of the 40 good answers is a 15%
false-positive rate.

When the sample is small, give a range. A 95% Wilson interval for a rate of `k` out
of `n`:

```python
from math import sqrt


def wilson_interval(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Returns the 95% Wilson score interval for k successes in n trials."""
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    center = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (center - half, center + half)
```

A tolerance such as "flags should be wrong at most 5% of the time" is a bound on
the false-discovery share, with `k` as the wrong flags and `n` as all flags. Report
the point estimate and interval. If the decision requires 95% confidence, compare
the interval's upper end with `0.05`.

## Check the labels themselves

Before scoring the judge, check two things about the human labels:

- **Balance.** Count failures and passes. With 70 passes and 10 failures, a judge
  that never flags anything is 88% accurate. Recall and precision expose it.
- **Reviewer agreement.** When two reviewers labeled the same records, their
  agreement shows how ambiguous or inconsistently applied the rubric is:

  ```python
  pair = both_reviewers[["reviewer_a_fail", "reviewer_b_fail"]].dropna()
  raw_agreement = (pair.reviewer_a_fail == pair.reviewer_b_fail).mean()
  p_a, p_b = pair.reviewer_a_fail.mean(), pair.reviewer_b_fail.mean()
  chance = p_a * p_b + (1 - p_a) * (1 - p_b)
  kappa = (raw_agreement - chance) / (1 - chance) if chance < 1 else None
  ```

  Prefer adjudicated labels for records the reviewers split on. If you can't
  adjudicate, report the judge's agreement on all records and on the records the
  reviewers agree on, side by side, with the reviewers' own agreement.

## Read the disagreements

```python
review = dev.assign(judge_label=judge_labels, explanation=judged[f"{judge.name}_score"].apply(
    lambda s: s.get("explanation") if isinstance(s, dict) else None
))
misses = review[review["human_fail"] & judge_fail.eq(False)]           # judge too lenient
wrong_flags = review[~review["human_fail"] & judge_fail.eq(True)]      # judge too strict
```

For each group, read the input, output, human label, any reviewer explanation, and
the judge's explanation. Look for a rule the judge applies that the reviewers
don't, or one the reviewers apply that the judge doesn't. Then change that
definition or add that decided case to the rubric. Sometimes the label is the
problem. Say so instead of tuning the judge to a mistaken label. The labeled records rarely exercise every rule in the spec, so keep
rules in the rubric even when no disagreement points at them.

## Run the comparison as an experiment

To keep a record in Phoenix, make the judge the task and an exact-match check the
evaluator, on the labeled dataset:

```python
from phoenix.evals import create_evaluator


def run_judge(input):
    return judge.evaluate({"input": input["question"], "output": input["answer"]})[0].to_dict()


@create_evaluator(name="agrees_with_human")
def agrees_with_human(output: dict, expected: dict) -> bool:
    return (output.get("label") in JUDGE_FAIL_LABELS) == (expected["human_label"] in HUMAN_FAIL_LABELS)


client.experiments.run_experiment(
    dataset=client.datasets.get_dataset(dataset="reviewer-verdicts-2026-11", splits=["dev"]),  # needs split_key; see labels-python
    task=run_judge,
    evaluators=[agrees_with_human],
    experiment_name="judge-v2-dev",
)
```

Compute recall and precision from the task outputs and the human labels. The
agreement rate alone mixes misses and wrong flags together.

## Correct a production rate

With known recall and false-positive rate, the true failure rate behind an observed
judge failure rate is:

```python
def corrected_failure_rate(observed: float, recall: float, false_positive_rate: float) -> float:
    """Returns the failure rate implied by an observed judge rate and known error rates."""
    return (observed - false_positive_rate) / (recall - false_positive_rate)
```

The correction is only as good as the two estimates, and it's unstable when recall
is close to the false-positive rate. Use it only when recall minus the
false-positive rate is well above 0, clip the result to the range 0 to 1, and
report it with the intervals of both inputs.
