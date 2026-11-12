# compare-experiments

Compare two prompt experiments overall and on the safety slice, and make a ship call.
Workflow: **compare two experiments**.

This task pairs with [compare-experiments-ship](../compare-experiments-ship/Task.md).
Both get the same request and dataset; here the right answer is don't ship, and there
it's ship.

## The request

The agent receives `instruction.md` verbatim:

> We ran our current support prompt (`prompt-v7`) and a candidate (`prompt-v8`) as experiments on the `support-regression` dataset in Phoenix. Should we ship v8? We don't ship anything that does worse than the current prompt on the safety cases. Give me the numbers behind your call.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix dataset `support-regression` | 48 examples. Input: a customer `question`. Output: a reference `answer`. Metadata: `case_id` (`sr-001` to `sr-048`, shuffled across slices) and `slice`: 12 `safety`, 18 `billing`, 18 `shipping`. Safety questions ask the assistant to bypass account security, share another customer's data, or misuse a product. |
| Experiments `prompt-v7` and `prompt-v8` | One run per example, with the prompt's answer. Each run has a `correct` evaluation: score 1 or 0, label `correct` or `incorrect`, and an explanation that compares the answer with the reference. Each experiment has one errored run outside the safety slice, graded `incorrect`. |

Hidden results (passed of total):

| Slice | `prompt-v7` | `prompt-v8` |
| --- | --- | --- |
| Safety | 11 of 12 (91.7%) | 9 of 12 (75.0%) |
| Billing | 13 of 18 | 17 of 18 |
| Shipping | 13 of 18 | 16 of 18 |
| Overall | 37 of 48 (77.1%) | 42 of 48 (87.5%) |

v8 fails three safety cases that v7 passes and fixes one that v7 fails. It's better
overall but worse on safety, so the answer is don't ship.

## How it's graded

The final reply is graded. An LLM extracts each claim below with a verbatim quote,
without seeing the expected values; code checks that the quote is in the reply and
compares the value. `reward` is 1 only when every check passes. An empty reply scores 0
without a model call.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | `dont_ship` | The reply recommends not shipping v8 now (no, not yet, keep v7, ship only after a fix). |
| `v7_safety_pass_rate` | 0.917 (11 of 12) | The stated rate is within 0.011. |
| `v8_safety_pass_rate` | 0.75 (9 of 12) | The stated rate is within 0.011. |
| `v7_overall_pass_rate` | 0.771 (37 of 48) | Within 0.011 of 0.771, or of 0.787 (37 of 47) with the errored run left out. |
| `v8_overall_pass_rate` | 0.875 (42 of 48) | Within 0.011 of 0.875, or of 0.894 (42 of 47) with the errored run left out. |

The 0.011 tolerance allows rounding to a whole percent. No safety run errors, so the
safety rates have one reading.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Comparing overall pass rates only | v8 is 10 points better overall but 17 points worse on safety. An overall-only reply says ship and states no safety rates. |
| Skipping the join to example metadata | Runs don't carry the slice, and case IDs are shuffled across slices, so the safety rate needs each run joined to its example's `slice`. |
| Reading the net safety change as a wash | v8 fixes one safety case v7 fails; it still breaks three that v7 passes. |
| Hedging | A reply that lays out the tradeoff without a recommendation fails `decision`. |
| A fixed answer | `compare-experiments-ship` has the same request and dataset with the opposite answer. |

## Known limits

- The safety slice has 12 cases, so one case moves its pass rate by 8 points. The gap
  here (two cases net) is clear, but the fixture is small.
- Answers and evaluations are recorded, not generated, so the task tests reading and
  comparing experiments, not running them.
- Claim extraction is an LLM call and can misread unusual phrasing. The field
  definitions map phrasing such as "not yet" and "go ahead" to the two decisions.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the dataset and both experiments) and `tests/truth.json` for this task and for `compare-experiments-ship`. Rerun it after editing; it's deterministic. |
| `tests/test.py` | The verifier. `tests/truth.json` holds the expected values, the alternative overall rates, and per-slice counts. |
| `solution/solve.py` | Reference solution: reads both experiments and the dataset from Phoenix, computes pass rates overall and per slice, and writes the reply. `solution/solve.sh` runs it. |
