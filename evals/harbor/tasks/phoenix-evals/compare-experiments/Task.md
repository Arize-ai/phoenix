# compare-experiments

The user ran two prompts as experiments and asks whether to ship the new one. The new
prompt is better overall but worse on the safety cases, so the right answer is don't
ship.

This task has a twin, [compare-experiments-ship](../compare-experiments-ship/Task.md).
The request, the dataset, and the verifier are the same. Only the experiment results
differ: there the new prompt is also better on safety, so the right answer is ship. An
agent that always says "don't ship", or that only looks at overall pass rates, fails one
of the two.

## The request

The agent gets `instruction.md` word for word:

> We ran our current support prompt (`prompt-v7`) and a candidate (`prompt-v8`) as experiments on the `support-regression` dataset in Phoenix. Should we ship v8? We don't ship anything that does worse than the current prompt on the safety cases. Give me the numbers behind your call.

## What the agent starts with

| Where | What |
| --- | --- |
| Dataset `support-regression` | 48 customer questions with reference answers. Each example's metadata has a `case_id` and a `slice`: 12 `safety`, 18 `billing`, 18 `shipping`. Case IDs are shuffled, so they don't reveal the slice. Safety questions ask the assistant to get around account security, share another customer's data, or misuse a product. |
| Experiments `prompt-v7` and `prompt-v8` | One run per example. Each run has a `correct` evaluation: score 1 or 0, label `correct` or `incorrect`, and an explanation. Each experiment has one run that errored, outside the safety slice, graded `incorrect`. |

The results, which the agent has to work out:

| Slice | `prompt-v7` | `prompt-v8` |
| --- | --- | --- |
| Safety | 11 of 12 (91.7%) | 9 of 12 (75.0%) |
| Billing | 13 of 18 | 17 of 18 |
| Shipping | 13 of 18 | 16 of 18 |
| Overall | 37 of 48 (77.1%) | 42 of 48 (87.5%) |

v8 fails three safety cases that v7 passes, and fixes one that v7 fails. It's 10 points
better overall and 17 points worse on safety.

## How it's graded

The verifier grades the agent's final reply. An LLM pulls out the decision and each
number below, with a quote from the reply, without seeing the expected values. Code then
checks that the quote is really in the reply and compares the value. An empty reply
scores 0 without a model call. `reward` is 1 only if every check passes.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | Don't ship | The reply says not to ship v8 now. "Not yet", "keep v7", and "ship after a fix" all count. |
| `v7_safety_pass_rate` | 91.7% (11 of 12) | The reply's number is within 1.1 points. |
| `v8_safety_pass_rate` | 75.0% (9 of 12) | Within 1.1 points. |
| `v7_overall_pass_rate` | 77.1% (37 of 48) | Within 1.1 points of 77.1%, or of 78.7% (37 of 47) if the reply leaves out the errored run. |
| `v8_overall_pass_rate` | 87.5% (42 of 48) | Within 1.1 points of 87.5%, or of 89.4% (42 of 47) if the reply leaves out the errored run. |

The 1.1-point tolerance allows rounding to a whole percent. No safety run errored, so
the safety rates have only one correct value.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

- **Checking the slice the user's rule is about.** The user's rule is about safety, and
  v8 looks better on every number except that one. An agent that compares overall pass
  rates says ship and fails.
- **Joining runs to example metadata.** Runs don't carry the slice, so the agent has to
  look up each run's example to get a safety pass rate.
- **Counting regressions, not just the net change.** v8 fixes one safety case and breaks
  three. Reading that as "about the same" misses the rule.
- **Making a call.** A reply that lays out the tradeoff without recommending anything
  fails `decision`.
- **Not answering from habit.** The twin task has the same request with the opposite
  answer.

## Known limits

- The safety slice has only 12 cases, so one case moves its pass rate by 8 points. The
  gap here is two cases net, which is clear, but the data is small.
- The answers and evaluations are recorded, not generated. The task tests reading and
  comparing experiments, not running them.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates the dataset and both experiments for this task and for `compare-experiments-ship`, into each task's `fixture/spec.json` and `tests/truth.json`. It's deterministic; rerun it after editing. |
| `tests/test.py` | The verifier. `tests/truth.json` holds the expected values, the overall rates without the errored run, and the per-slice counts. |
| `solution/solve.py` | The reference solution. It reads both experiments and the dataset from Phoenix, computes pass rates overall and per slice, and writes the reply. `solution/solve.sh` runs it. |
