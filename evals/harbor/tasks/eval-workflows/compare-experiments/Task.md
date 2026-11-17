# compare-experiments

The user ran two prompts as experiments and asks whether to ship the new one. Each
experiment ran every question three times, because the model isn't deterministic. The
new prompt is better overall but gives unsafe answers more often, so the right answer is
don't ship. Its safety failures are intermittent, so a reading that keeps one
repetition per question, or takes a majority vote, makes it look safe enough.

This task has a twin, [compare-experiments-ship](../compare-experiments-ship/Task.md).
The request, the dataset, and the verifier are the same. Only the experiment results
differ: there the new prompt is at least as good on safety by every reading, so the
right answer is ship. An agent that always says "don't ship", or that only looks at
overall pass rates, fails one of the two. An agent that drops repetitions fails both.

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
| Safety | 31 of 36 (86.1%) | 29 of 36 (80.6%) | 9 of 12 (75.0%) | 5 of 12 (41.7%) |
| Billing | 40 of 54 | 50 of 54 | 10 of 18 | 15 of 18 |
| Shipping | 46 of 54 | 47 of 54 | 14 of 18 | 15 of 18 |
| Overall | 117 of 144 (81.3%) | 126 of 144 (87.5%) | 33 of 48 (68.8%) | 35 of 48 (72.9%) |

On safety, v7 fails the two-factor question (`sr-038`) in every repetition and two other
questions once each. v8 fixes all three, but fails seven safety questions that v7 passes
every time, each in one repetition of three. For example, asked whether to tape over a
hissing pressure cooker valve, v8 says not to in two repetitions and recommends
heat-resistant tape in the third.

That pattern is the trap. Readings that drop repetitions reach the wrong call:

| Reading | v7 safety | v8 safety | v7 overall | v8 overall | Call |
| --- | --- | --- | --- | --- | --- |
| Every run (accepted) | 86.1% | 80.6% | 81.3% | 87.5% | Don't ship |
| Cases that pass all 3 (accepted) | 75.0% | 41.7% | 68.8% | 72.9% | Don't ship |
| Repetition 1 only | 83.3% | 83.3% | 79.2% | 85.4% | Ship |
| Repetition 3 only | 83.3% | 83.3% | 79.2% | 85.4% | Ship |
| Majority vote per case | 91.7% | 100% | 87.5% | 91.7% | Ship |
| Any repetition passes | 91.7% | 100% | 87.5% | 97.9% | Ship |

An agent that keys runs by example ID keeps one repetition without noticing. The Phoenix
Python client lists runs newest first, so a dict keyed by example keeps repetition 1.
The REST JSON export and `px experiment get` list runs by example and then repetition,
so the dict keeps repetition 3. Either way, v8 ties v7 on safety and looks better
overall.

## How it's graded

The verifier grades the agent's final reply. An LLM pulls out the decision and each
number below, with a quote from the reply, without seeing the expected values. Code then
checks that the quote is really in the reply and compares the value. An empty reply
scores 0 without a model call. `reward` is 1 only if every check passes.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | Don't ship | The reply says not to ship v8 now. "Not yet", "keep v7", and "ship after a fix" all count. |
| `v7_safety_pass_rate` | 86.1% (31 of 36 runs) | The reply's number is within 1.1 points of 86.1%, or of 75.0% (9 of 12 cases pass all 3). |
| `v8_safety_pass_rate` | 80.6% (29 of 36 runs) | Within 1.1 points of 80.6%, or of 41.7% (5 of 12 cases). |
| `v7_overall_pass_rate` | 81.3% (117 of 144 runs) | Within 1.1 points of 81.3%, 81.8% (117 of 143, leaving out the errored run), 68.8% (33 of 48 cases), or 70.2% (33 of 47, leaving out the errored run's case). |
| `v8_overall_pass_rate` | 87.5% (126 of 144 runs) | Within 1.1 points of 87.5%, 88.1% (126 of 143), 72.9% (35 of 48 cases), or 74.5% (35 of 47). |

Two readings of a pass rate are accepted, and they lead to the same call in both twins:

- **The share of runs that passed.** It's how often a customer gets a correct answer,
  and it's the average that Phoenix shows for an experiment's `correct` evaluator.
- **The share of cases that passed all 3 repetitions.** It's how many questions the
  prompt handles reliably.

Both count every repetition, so both see an intermittent unsafe answer. Readings that
don't are rejected. One repetition per case throws away two thirds of the runs, and a
majority vote counts a case as passing when one answer in three was unsafe, which is
the failure the user's rule exists to catch. `fixture/build.py` computes every reading
(each single repetition, majority vote, any-pass, and each of those with the errored
run left out) and asserts that none of them, stated exactly or rounded to a whole
percent either way, lands within 1.1 points of an accepted value.

The 1.1-point tolerance allows rounding to a whole percent. Each errored run belongs to
a case that fails its other two repetitions too, so leaving the errored run out changes
only a denominator. No safety run errored, so the safety rates have one value per
reading.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

- **Counting every repetition.** Each example has three runs. An agent that keys runs
  by example ID keeps one repetition, gets every number wrong, and here sees v8 tie v7
  on safety, so it ships.
- **Not averaging away intermittent failures.** A majority vote per case says v8 passes
  every safety case. v8 gives an unsafe answer in 7 of 36 safety runs, and v7 in 5.
- **Checking the slice the user's rule is about.** v8 looks better on every number
  except safety. An agent that compares overall pass rates says ship and fails.
- **Joining runs to example metadata.** Runs don't carry the slice, so the agent has to
  look up each run's example to get a safety pass rate.
- **Making a call.** A reply that lays out the tradeoff without recommending anything
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
| Python client runs keyed by example ID (repetition 1) | 0 | `decision`, all four rates |
| REST JSON export keyed by example ID (repetition 3) | 0 | `decision`, all four rates |
| Majority vote per case | 0 | `decision`, all four rates |
| Any repetition passes | 0 | `decision`, all four rates |
| Overall rates only | 0 | `decision`, `v7_safety_pass_rate`, `v8_safety_pass_rate` |

We also replayed the four pilot agents' shell commands, unchanged except for the
endpoint and paths, against this fixture. All four key runs by example ID, so they'd
report the repetition-3 reading:

| Pilot agent | How it read the runs | What its code reports on this data |
| --- | --- | --- |
| Fable | REST `/v1/experiments/{id}/json`, dict keyed by `example_id` | Safety 10 of 12 for both, overall 79.2% and 85.4% |
| Fable with skills | `px experiment get`, `jq` `from_entries` keyed by `example_id` | Same |
| Haiku | REST `/v1/experiments/{id}/json`, dict keyed by `example_id`, errored runs left out | Same |
| Haiku with skills | `px experiment get`, dict keyed by `example_id` | Same |

None of those numbers is within tolerance, so each would fail all four rate checks, and
a safety tie under the user's rule points to ship, which fails `decision` too. This is a
prediction from their code: on the new data each script also prints 144 runs per
experiment, which an agent might notice before it writes the reply.

## Known limits

- The safety slice has 12 cases. v8's per-run safety gap is 2 runs of 36 (5.6 points),
  and its gap in cases that pass all 3 is 4 of 12. The rule is "no worse", so the call
  is clear, but a team might want more repetitions before trusting a gap that size.
- The two accepted readings agree here by construction. A reply that mixes them, such
  as v7's per-run rate with v8's all-pass rate, passes the rate checks; the decision is
  graded on its own.
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
| `fixture/build.py` | Generates the dataset and both experiments for this task and for `compare-experiments-ship`, into each task's `fixture/phoenix_seed.json` and `tests/truth.json`. Each case gets a pass pattern per prompt, such as `PFP` for a fail in repetition 2. The script computes every reading and asserts the design: both accepted readings reach the right call, and no rejected reading is within tolerance of an accepted value. It's deterministic; rerun it after editing. |
| `tests/test.py` | The verifier. `tests/truth.json` holds the expected values, the other accepted values under `alternatives`, every reading's values and call under `readings`, and per-slice counts. |
| `solution/solve.py` | The reference solution. It reads both experiments and the dataset from Phoenix, groups runs by example and repetition, computes per-run and all-pass rates overall and per slice, and writes the reply. `solution/solve.sh` runs it. |
