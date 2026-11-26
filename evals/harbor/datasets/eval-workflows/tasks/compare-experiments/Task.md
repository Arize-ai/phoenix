# compare-experiments

The user ran two prompts as experiments, with three repetitions of every question, and
asks whether to ship the new one. The new prompt passes more runs overall but gives
unsafe answers more often, so the right answer is don't ship. Each unsafe answer happens
in only one repetition of three, so the task tests whether the agent counts every
repetition instead of one per question or a majority vote.

## The request

The agent gets `instruction.md` word for word:

> We ran our current support prompt (`prompt-v7`) and a candidate (`prompt-v8`) as experiments on the `support-regression` dataset in Phoenix. Should we ship v8? We don't ship anything that does worse than the current prompt on the safety cases. Give me the numbers behind your call.

## What the agent starts with

| Where | What |
| --- | --- |
| Dataset `support-regression` | 48 customer questions with reference answers. Each example's metadata has a `case_id` and a `slice`: 12 `safety`, 18 `billing`, and 18 `shipping`. Safety questions ask the assistant to get around account security, share another customer's data, or misuse a product. |
| Experiments `prompt-v7` and `prompt-v8` | 144 runs each: every example three times, numbered by `repetition_number`. Each run that didn't error has its own output, and every run has a `correct` evaluation with a score of 1 or 0, a label, and an explanation. Each experiment has one run that errored, outside the safety slice, graded `incorrect`. |
| `/app` | Empty. |

## How the data was made

`fixture/build.py` generates the data for this task and its twin,
[compare-experiments-ship](../compare-experiments-ship/Task.md), which sends the same
request with data where the right answer is ship. The 48 questions, their reference
answers, one wrong answer per question, the grader's explanations, and three phrasings
per prompt are hand-written. No model wrote any output or evaluation.

Each case gets a pass pattern per prompt, with one letter per repetition, such as `PFP`.
A `P` run outputs the reference answer and is graded `correct`. An `F` run outputs the
wrong answer and is graded `incorrect`. How many cases in each slice get each pair of v7
and v8 patterns is hand-written. Fixed random seeds decide the rest:

- Seed 3 shuffles the questions into case IDs, so an ID doesn't reveal its slice.
- Seed 5 assigns the pattern pairs to cases within each slice. It also picks the case
  that holds each experiment's errored run, among the cases in a hand-picked slice that
  fail every repetition.
- Seed 6 orders each case's three phrasings across its repetitions.

The patterns hide the safety regression from any reading that doesn't count every
repetition. v7 fails the two-factor question (`sr-038`) in every repetition and two other
safety questions once each. v8 passes those three, but fails seven safety questions that
v7 always passes, each in one repetition. For example, asked whether to tape over a
hissing pressure cooker valve, v8 says not to twice and recommends heat-resistant tape
once.

`build.py` asserts that:

- Every accepted reading, listed under [How it's graded](#how-its-graded), gives don't
  ship.
- Repetition 1 alone, repetition 3 alone, a majority vote per case, and any repetition
  passing all give ship.
- No rejected reading of any rate, exact or rounded to a whole percent, lands within 1.1
  points of an accepted value.
- Each errored run is outside the safety slice, in a case that fails all three
  repetitions, so leaving it out changes only a denominator.

GPT-6 Astra checked the questions, answers, and labels.

## How it's graded

The verifier grades the agent's final reply. An LLM reads the reply without seeing the
answers and extracts the decision and four pass rates, each with a quote. Code checks
that each quote is in the reply and compares each value with `tests/expected.json`. An
empty reply scores 0 without a model call.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `decision` | LLM extraction, then code | `expected.json` | The reply recommends not shipping v8 now. "Not yet", "keep v7", and "ship after a fix" count. |
| `numbers` | LLM extraction, then code | `expected.json` | The reply gives v7's and v8's pass rates on the safety cases and overall, and all four match one complete reading in the next table within 1.1 points. |

`numbers` accepts two readings of a pass rate. Both count every repetition, so both catch
an answer that's unsafe one time in three. The share of runs is the average that Phoenix
shows for the `correct` evaluator.

| Rate | Share of runs that passed | Share of cases that passed all 3 |
| --- | --- | --- |
| v7 safety | 86.1% (31 of 36) | 75.0% (9 of 12) |
| v8 safety | 80.6% (29 of 36) | 41.7% (5 of 12) |
| v7 overall | 81.3% (117 of 144), or 81.8% (117 of 143) | 68.8% (33 of 48), or 70.2% (33 of 47) |
| v8 overall | 87.5% (126 of 144), or 88.1% (126 of 143) | 72.9% (35 of 48), or 74.5% (35 of 47) |

The second overall value leaves out the errored run, or its case. The 1.1-point
tolerance allows rounding to a whole percent. `numbers` rejects one repetition per case,
a majority vote, and any repetition passing, because each one hides an answer that's
unsafe one time in three.

`reward` is 1 only when every check passes. The run also reports these measures, which
don't affect `reward`:

- `turn_count` counts the steps in the agent's trajectory.
- `tool_count` counts the agent's tool calls.
- `loaded_<skill>` is 1 if the agent loaded that skill and 0 if it didn't. There's one
  key for each Phoenix skill, such as `loaded_phoenix_evals`, and one for any other
  skill the agent loaded. `details.json` lists the skills loaded, in order.

## What the task tests

| Wrong approach | What it concludes | Fails |
| --- | --- | --- |
| Keys runs by example ID, which keeps the first or the last repetition | v8 ties v7 on safety at 83.3%, so ship | `decision`, `numbers` |
| Takes a majority vote per case, or passes a case if any repetition passes | v8 beats v7 on safety, 100% to 91.7%, so ship | `decision`, `numbers` |
| Compares only overall pass rates | v8 is better, 87.5% to 81.3%, so ship | `decision`, `numbers` |
| Lays out the tradeoff without a recommendation | No call | `decision` |

## Calibration

The reference solution scores 1, and an agent that does nothing scores 0. Scripted
replies that keep one repetition per case, take a majority vote, count any passing
repetition, or give only overall rates score 0, and one that reports the share of cases
that passed all 3 scores 1.

## Known limits

- The safety gap is 2 runs of 36. The user's rule is "no worse", so any gap decides the
  call, but an agent that calls the gap noise and ships fails `decision`.
- `numbers` requires the overall rates too. Here the safety rates alone decide the call,
  so a reply that backs its call with only the safety rates fails.
- An LLM extracts the decision and rates, so it can misread unusual wording. Its
  instructions map phrases such as "not yet" and "go ahead" to the two decisions.
