# compare-experiments-ship

The user ran two prompts as experiments and asks whether to ship the new one. The new
prompt is better overall and on the safety cases, so the right answer is ship.

This task is the twin of [compare-experiments](../compare-experiments/Task.md). The
request, the dataset, and the verifier are the same. Only the experiment results differ:
there the new prompt is worse on safety, so the right answer is don't ship. Here the new
prompt is one case worse on shipping instead, which the user's rule doesn't cover. An
agent that always says "don't ship", or blocks on any slice that got worse, fails this
one.

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
| Safety | 10 of 12 (83.3%) | 11 of 12 (91.7%) |
| Billing | 12 of 18 | 17 of 18 |
| Shipping | 14 of 18 | 13 of 18 |
| Overall | 36 of 48 (75.0%) | 41 of 48 (85.4%) |

v8 fails one safety case, which v7 also fails. It's better overall and on safety, and
one case worse on shipping.

## How it's graded

The verifier grades the agent's final reply. An LLM pulls out the decision and each
number below, with a quote from the reply, without seeing the expected values. Code then
checks that the quote is really in the reply and compares the value. An empty reply
scores 0 without a model call. `reward` is 1 only if every check passes.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | Ship | The reply says to ship v8 now. "Yes", "go ahead", and "roll it out" count. Waiting or fixing something first fails. |
| `v7_safety_pass_rate` | 83.3% (10 of 12) | The reply's number is within 1.1 points. |
| `v8_safety_pass_rate` | 91.7% (11 of 12) | Within 1.1 points. |
| `v7_overall_pass_rate` | 75.0% (36 of 48) | Within 1.1 points of 75.0%, or of 76.6% (36 of 47) if the reply leaves out the errored run. |
| `v8_overall_pass_rate` | 85.4% (41 of 48) | Within 1.1 points of 85.4%, or of 87.2% (41 of 47) if the reply leaves out the errored run. |

The 1.1-point tolerance allows rounding to a whole percent. No safety run errored, so
the safety rates have only one correct value.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

- **Applying the user's rule as stated.** The rule is about safety only. Holding v8
  back because shipping got one case worse fails `decision`.
- **Backing the call with the right numbers.** An agent that compares only overall pass
  rates gets the decision right here, but the reply has no safety rates, so it fails.
- **Joining runs to example metadata.** Runs don't carry the slice, so the agent has to
  look up each run's example to get a safety pass rate.
- **Making a call.** A reply that lays out the numbers without recommending anything
  fails `decision`.
- **Not answering from habit.** The twin task has the same request with the opposite
  answer.

## Known limits

- The safety slice has only 12 cases, so one case moves its pass rate by 8 points. v8
  leads v7 on safety by one case. That's small, but there's no ambiguity about the rule.
- The answers and evaluations are recorded, not generated. The task tests reading and
  comparing experiments, not running them.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Runs the shared generator in `../compare-experiments/fixture/build.py`, which writes `fixture/spec.json` and `tests/truth.json` for both tasks. |
| `tests/test.py` | The verifier, the same as `compare-experiments`'s. `tests/truth.json` holds the expected values, the overall rates without the errored run, and the per-slice counts. |
| `solution/solve.py` | The reference solution, the same as `compare-experiments`'s. It reads both experiments and the dataset from Phoenix, computes pass rates overall and per slice, and writes the reply. |
