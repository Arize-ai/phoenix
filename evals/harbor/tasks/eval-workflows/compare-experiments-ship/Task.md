# compare-experiments-ship

The user ran two prompts as experiments, with three repetitions of every question, and
asks whether to ship the new one. The new prompt is no worse on safety by any reading and
better overall, so the right answer is ship, even though it's one run worse on shipping
questions, which the user's rule doesn't cover. The task tests whether the agent applies
the rule as stated and backs its call with pass rates that count every repetition.

## The request

The agent gets `instruction.md` word for word:

> We ran our current support prompt (`prompt-v7`) and a candidate (`prompt-v8`) as experiments on the `support-regression` dataset in Phoenix. Should we ship v8? We don't ship anything that does worse than the current prompt on the safety cases. Give me the numbers behind your call.

## What the agent starts with

| Where | What |
| --- | --- |
| Dataset `support-regression` | 48 customer questions with reference answers. Each example's metadata has a `case_id` and a `slice`: 12 `safety`, 18 `billing`, and 18 `shipping`. Safety questions ask the assistant to get around account security, share another customer's data, or misuse a product. |
| Experiments `prompt-v7` and `prompt-v8` | 144 runs each: every example three times, numbered by `repetition_number`. Each run has its own output and a `correct` evaluation with a score of 1 or 0, a label, and an explanation. Each experiment has one run that errored, outside the safety slice, graded `incorrect`. |
| `/app` | Empty. |

## How the data was made

This task is the twin of [compare-experiments](../compare-experiments/Task.md), which
sends the same request with data where the right answer is don't ship. The generator in
`../compare-experiments/fixture/build.py` builds both twins from the same questions,
answers, phrasings, and labeling rule. See
[compare-experiments](../compare-experiments/Task.md#how-the-data-was-made) for how it
works and what GPT-6 Astra checked. This twin differs in these ways:

- Seed 29 assigns the pattern pairs and picks the errored runs, and seed 30 orders the
  phrasings.
- The hand-written pattern counts make v8 no worse on safety. v8 fails only safety
  questions that v7 also fails, and never more often. v7 fails the tent heater question
  (`sr-027`) in every repetition, and v8 fails it once. Each prompt fails the 60V
  charger question (`sr-005`) once.
- v8 is one run worse on shipping, because it fails the delivery date question
  (`sr-041`) in every repetition that didn't error. No shipping or billing question has a
  safety side, so a wrong answer there doesn't touch the user's rule.

`build.py` asserts that every accepted reading gives ship, that no rejected reading of
any rate, exact or rounded to a whole percent, lands within 1.1 points of an accepted
value, and that v8 passes fewer shipping runs than v7. The rejected readings give ship
too, so here they fail only on the numbers.

## How it's graded

The verifier grades the agent's final reply. An LLM reads the reply without seeing the
answers and extracts the decision and four pass rates, each with a quote. Code checks
that each quote is in the reply and compares each value with `tests/expected.json`. An
empty reply scores 0 without a model call.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `decision` | LLM extraction, then code | `expected.json` | The reply recommends shipping v8 now. "Yes", "go ahead", and "roll it out" count. Waiting or fixing something first fails. |
| `numbers` | LLM extraction, then code | `expected.json` | The reply gives v7's and v8's pass rates on the safety cases and overall, and all four match one complete reading in the next table within 1.1 points. |

`numbers` accepts two readings of a pass rate. Both count every repetition, so both catch
an answer that's unsafe one time in three. The share of runs is the average that Phoenix
shows for the `correct` evaluator.

| Rate | Share of runs that passed | Share of cases that passed all 3 |
| --- | --- | --- |
| v7 safety | 86.1% (31 of 36) | 75.0% (9 of 12) |
| v8 safety | 94.4% (34 of 36) | 83.3% (10 of 12) |
| v7 overall | 83.3% (120 of 144), or 83.9% (120 of 143) | 70.8% (34 of 48), or 72.3% (34 of 47) |
| v8 overall | 93.8% (135 of 144), or 94.4% (135 of 143) | 85.4% (41 of 48), or 87.2% (41 of 47) |

The second overall value leaves out the errored run, or its case. The 1.1-point
tolerance allows rounding to a whole percent. `numbers` rejects one repetition per case,
a majority vote, and any repetition passing, because each one hides an answer that's
unsafe one time in three.

`reward` is 1 only when every check passes. The run also reports these measures, which
don't affect `reward`:

- `turns` counts the steps in the agent's trajectory.
- `tool_calls` counts the agent's tool calls.
- `loaded_<skill>` is 1 if the agent loaded that skill and 0 if it didn't. There's one
  key for each Phoenix skill, such as `loaded_phoenix_evals`, and one for any other
  skill the agent loaded. `details.json` lists the skills loaded, in order.

## What the task tests

| Wrong approach | What it concludes | Fails |
| --- | --- | --- |
| Holds v8 back because shipping got one run worse | Don't ship | `decision` |
| Holds v8 back because it still gives an unsafe answer in 2 of 36 safety runs | Don't ship | `decision` |
| Keys runs by example ID, so each case keeps one repetition | Ship, with v8's safety rate at 100% or 91.7% | `numbers` |
| Takes a majority vote per case, or passes a case if any repetition passes | Ship, with v8's safety rate at 100% | `numbers` |
| Compares only overall pass rates | Ship, with no safety rates | `numbers` |
| Lays out the numbers without a recommendation | No call | `decision` |

## Calibration

The reference solution scores 1, and an agent that does nothing scores 0. Scripted
replies that keep one repetition per case, take a majority vote, count any passing
repetition, or give only overall rates make the right call but score 0, and one that
reports the share of cases that passed all 3 scores 1.

## Known limits

- The user's rule sets a floor, not the whole decision. The task treats "no worse on
  safety and better overall" as ship, so a reply that holds v8 back for another reason,
  such as the shipping regression, fails `decision`, though a cautious team might agree
  with it.
- v8's safety lead is 3 runs of 36. An agent that calls the lead noise and asks for more
  runs before shipping fails `decision`.
- An LLM extracts the decision and rates, so it can misread unusual wording. Its
  instructions map phrases such as "not yet" and "go ahead" to the two decisions.
