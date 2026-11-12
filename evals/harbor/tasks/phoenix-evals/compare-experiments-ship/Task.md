# compare-experiments-ship

Compare two prompt experiments overall and on the safety slice, and make a ship call.
Workflow: **compare two experiments**.

This task pairs with [compare-experiments](../compare-experiments/Task.md). Both get the
same request and dataset; here the right answer is ship, and there it's don't ship.

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
| Safety | 10 of 12 (83.3%) | 11 of 12 (91.7%) |
| Billing | 12 of 18 | 17 of 18 |
| Shipping | 14 of 18 | 13 of 18 |
| Overall | 36 of 48 (75.0%) | 41 of 48 (85.4%) |

v8 fails only one safety case, which v7 also fails. It's better overall and on safety,
so the answer is ship. It's one case worse on shipping, which the ship rule doesn't
cover.

## How it's graded

The final reply is graded. An LLM extracts each claim below with a verbatim quote,
without seeing the expected values; code checks that the quote is in the reply and
compares the value. `reward` is 1 only when every check passes. An empty reply scores 0
without a model call.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | `ship` | The reply recommends shipping v8 now (yes, go ahead, roll it out). A recommendation to wait or fix something first fails. |
| `v7_safety_pass_rate` | 0.833 (10 of 12) | The stated rate is within 0.011. |
| `v8_safety_pass_rate` | 0.917 (11 of 12) | The stated rate is within 0.011. |
| `v7_overall_pass_rate` | 0.75 (36 of 48) | Within 0.011 of 0.75, or of 0.766 (36 of 47) with the errored run left out. |
| `v8_overall_pass_rate` | 0.854 (41 of 48) | Within 0.011 of 0.854, or of 0.872 (41 of 47) with the errored run left out. |

The 0.011 tolerance allows rounding to a whole percent. No safety run errors, so the
safety rates have one reading.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Blocking on any slice regression | v8 is one case worse on shipping. The rule covers only safety, so holding v8 back for shipping fails `decision`. |
| Comparing overall pass rates only | The decision comes out right, but the reply states no safety rates, so it fails. |
| Skipping the join to example metadata | Runs don't carry the slice, and case IDs are shuffled across slices, so the safety rate needs each run joined to its example's `slice`. |
| Hedging | A reply that lays out the numbers without a recommendation fails `decision`. |
| A fixed answer | `compare-experiments` has the same request and dataset with the opposite answer. |

## Known limits

- The safety slice has 12 cases, so one case moves its pass rate by 8 points. v8 leads
  v7 on safety by one case, so the fixture is small but unambiguous.
- Answers and evaluations are recorded, not generated, so the task tests reading and
  comparing experiments, not running them.
- Claim extraction is an LLM call and can misread unusual phrasing. The field
  definitions map phrasing such as "not yet" and "go ahead" to the two decisions.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Runs the shared generator in `../compare-experiments/fixture/build.py`, which writes `fixture/spec.json` and `tests/truth.json` for both tasks. |
| `tests/test.py` | The verifier, identical to `compare-experiments`'s. `tests/truth.json` holds the expected values, the alternative overall rates, and per-slice counts. |
| `solution/solve.py` | Reference solution, identical to `compare-experiments`'s: reads both experiments and the dataset from Phoenix, computes pass rates overall and per slice, and writes the reply. |
