# compare-experiments-ship

The user ran two prompts as experiments and asks whether to ship the new one. Each
experiment ran every question three times, because the model isn't deterministic. The
new prompt is better overall and at least as good on the safety cases by every reading,
so the right answer is ship.

This task is the twin of [compare-experiments](../compare-experiments/Task.md). The
request, the dataset, and the verifier are the same. Only the experiment results differ:
there the new prompt gives unsafe answers more often, so the right answer is don't ship.
Here the new prompt is one run worse on shipping instead, which the user's rule doesn't
cover. An agent that always says "don't ship", or blocks on any slice that got worse,
fails this one. An agent that keeps one repetition per question, or takes a majority
vote, makes the right call here but reports the wrong numbers, so it fails both twins.

## The request

The agent gets `instruction.md` word for word:

> We ran our current support prompt (`prompt-v7`) and a candidate (`prompt-v8`) as experiments on the `support-regression` dataset in Phoenix. Should we ship v8? We don't ship anything that does worse than the current prompt on the safety cases. Give me the numbers behind your call.

## What the agent starts with

| Where | What |
| --- | --- |
| Dataset `support-regression` | 48 customer questions with reference answers. Each example's metadata has a `case_id` and a `slice`: 12 `safety`, 18 `billing`, 18 `shipping`. Case IDs are shuffled, so they don't reveal the slice. Safety questions ask the assistant to get around account security, share another customer's data, or misuse a product. |
| Experiments `prompt-v7` and `prompt-v8` | Three repetitions of every example, so 144 runs each. Each experiment's record says `repetitions: 3`, and each run has a `repetition_number`. Every run has its own output, worded differently from the other repetitions, and its own `correct` evaluation: score 1 or 0, label `correct` or `incorrect`, and an explanation. Each experiment has one run that errored, outside the safety slice, graded `incorrect`. |

The results, which the agent has to work out:

| Slice | `prompt-v7` runs | `prompt-v8` runs | `prompt-v7` cases that pass all 3 | `prompt-v8` cases that pass all 3 |
| --- | --- | --- | --- | --- |
| Safety | 31 of 36 (86.1%) | 34 of 36 (94.4%) | 9 of 12 (75.0%) | 10 of 12 (83.3%) |
| Billing | 40 of 54 | 53 of 54 | 10 of 18 | 17 of 18 |
| Shipping | 49 of 54 | 48 of 54 | 15 of 18 | 14 of 18 |
| Overall | 120 of 144 (83.3%) | 135 of 144 (93.8%) | 34 of 48 (70.8%) | 41 of 48 (85.4%) |

On safety, v8 fails only questions that v7 also fails, and never more often. v7 fails
the tent heater question (`sr-027`) in every repetition and v8 fails it once. Both fail
the 60V charger question (`sr-005`) once. v8 is one run worse on shipping, and it fails
the delivery date question (`sr-041`) in every run that didn't error. No shipping or
billing question has a safety side, so a wrong answer there doesn't touch the rule.

Every reading reaches the same call here, but only two give the accepted numbers:

| Reading | v7 safety | v8 safety | v7 overall | v8 overall | Call |
| --- | --- | --- | --- | --- | --- |
| Every run (accepted) | 86.1% | 94.4% | 83.3% | 93.8% | Ship |
| Cases that pass all 3 (accepted) | 75.0% | 83.3% | 70.8% | 85.4% | Ship |
| Repetition 1 only | 83.3% | 100% | 81.3% | 97.9% | Ship |
| Repetition 3 only | 83.3% | 91.7% | 81.3% | 91.7% | Ship |
| Majority vote per case | 91.7% | 100% | 89.6% | 97.9% | Ship |
| Any repetition passes | 91.7% | 100% | 89.6% | 97.9% | Ship |

An agent that keys runs by example ID keeps one repetition without noticing. The Phoenix
Python client lists runs newest first, so a dict keyed by example keeps repetition 1.
The REST JSON export and `px experiment get` list runs by example and then repetition,
so the dict keeps repetition 3.

## How it's graded

The verifier grades the agent's final reply. An LLM pulls out the decision and each
number below, with a quote from the reply, without seeing the expected values. Code then
checks that the quote is really in the reply and compares the value. An empty reply
scores 0 without a model call. `reward` is 1 only if every check passes.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | Ship | The reply says to ship v8 now. "Yes", "go ahead", and "roll it out" count. Waiting or fixing something first fails. |
| `v7_safety_pass_rate` | 86.1% (31 of 36 runs) | The reply's number is within 1.1 points of 86.1%, or of 75.0% (9 of 12 cases pass all 3). |
| `v8_safety_pass_rate` | 94.4% (34 of 36 runs) | Within 1.1 points of 94.4%, or of 83.3% (10 of 12 cases). |
| `v7_overall_pass_rate` | 83.3% (120 of 144 runs) | Within 1.1 points of 83.3%, 83.9% (120 of 143, leaving out the errored run), 70.8% (34 of 48 cases), or 72.3% (34 of 47, leaving out the errored run's case). |
| `v8_overall_pass_rate` | 93.8% (135 of 144 runs) | Within 1.1 points of 93.8%, 94.4% (135 of 143), 85.4% (41 of 48 cases), or 87.2% (41 of 47). |

Two readings of a pass rate are accepted: the share of runs that passed, which is the
average Phoenix shows for an experiment's `correct` evaluator, and the share of cases
that passed all 3 repetitions. Both count every repetition. A single repetition per case
or a majority vote is rejected. The
[compare-experiments page](../compare-experiments/Task.md#how-its-graded) explains why,
and `fixture/build.py` asserts that no rejected reading, stated exactly or rounded to a
whole percent either way, lands within 1.1 points of an accepted value.

The 1.1-point tolerance allows rounding to a whole percent. Each errored run belongs to
a case that fails its other two repetitions too, so leaving the errored run out changes
only a denominator. No safety run errored, so the safety rates have one value per
reading.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

- **Applying the user's rule as stated.** The rule is about safety only. Holding v8
  back because shipping got one run worse, or because v8 still fails a safety question
  once, fails `decision`.
- **Counting every repetition.** An agent that keys runs by example ID, or takes a
  majority vote, makes the right call here with the wrong numbers, so it fails.
- **Backing the call with the right numbers.** An agent that compares only overall pass
  rates gets the decision right here, but the reply has no safety rates, so it fails.
- **Joining runs to example metadata.** Runs don't carry the slice, so the agent has to
  look up each run's example to get a safety pass rate.
- **Making a call.** A reply that lays out the numbers without recommending anything
  fails `decision`.
- **Not answering from habit.** The twin task has the same request with the opposite
  answer.

Controls we ran locally against the seeded data. Each control is a script that reads
both experiments from Phoenix, aggregates them one way, and writes a reply in the
reference solution's format; the verifier then grades it, including the LLM
extraction:

| Control | Reward | Failing checks |
| --- | --- | --- |
| No reply (nop) | 0 | All |
| Reference solution, 4 runs | 1, 1, 1, 1 | None |
| Cases that pass all 3, as the headline rates | 1 | None |
| Python client runs keyed by example ID (repetition 1) | 0 | all four rates |
| REST JSON export keyed by example ID (repetition 3) | 0 | all four rates |
| Majority vote per case | 0 | all four rates |
| Any repetition passes | 0 | all four rates |
| Overall rates only | 0 | `v7_safety_pass_rate`, `v8_safety_pass_rate` |

We also replayed the four pilot agents' shell commands, unchanged except for the
endpoint and paths, against this fixture. All four key runs by example ID:

| Pilot agent | How it read the runs | What its code reports on this data |
| --- | --- | --- |
| Fable | REST `/v1/experiments/{id}/json`, dict keyed by `example_id` | Repetition 3: safety 83.3% and 91.7%, overall 81.3% and 91.7% |
| Fable with skills | `px experiment get`, `jq` `from_entries` keyed by `example_id` | Same. Its code also counts runs per `repetition_number` and prints 48 for each, so it might notice. |
| Haiku | Python client `get_experiment`, task runs keyed by `dataset_example_id`, errored runs left out | Repetition 1: safety 83.3% and 100%, overall 81.3% and 100% (47 of 47) |
| Haiku with skills | `px experiment get`, dict keyed by `example_id` | Repetition 3, as for Fable |

None of those numbers is within tolerance, so each would fail all four rate checks even
with the right call. In the pilot, both Haiku agents also held v8 back on this twin for
reasons outside the rule. This is a prediction from their code: on the new data each
script also prints 144 runs per experiment, which an agent might notice before it
writes the reply.

## Known limits

- The safety slice has 12 cases. v8 leads v7 on safety by 3 runs of 36 and by 1 case
  that passes all 3. That's small, but there's no ambiguity about the rule.
- The two accepted readings agree here by construction. A reply that mixes them passes
  the rate checks; the decision is graded on its own.
- Which repetition a by-example dict keeps depends on Phoenix's run order. The task
  rejects every single-repetition reading, so the grade doesn't depend on that order.
- The answers and evaluations are recorded, not generated. The task tests reading and
  comparing experiments, not running them.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions. If a reply gives both accepted readings, the extractor picks one as the
  headline, and either passes.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Runs the shared generator in `../compare-experiments/fixture/build.py`, which writes `fixture/phoenix_seed.json` and `tests/truth.json` for both tasks. |
| `tests/test.py` | The verifier, the same as `compare-experiments`'s. `tests/truth.json` holds the expected values, the other accepted values under `alternatives`, every reading's values and call under `readings`, and per-slice counts. |
| `solution/solve.py` | The reference solution, the same as `compare-experiments`'s. It reads both experiments and the dataset from Phoenix, groups runs by example and repetition, computes per-run and all-pass rates overall and per slice, and writes the reply. |
