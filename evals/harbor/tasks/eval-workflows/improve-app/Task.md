# improve-app

The user's support assistant breaks its handbook: it makes promises it shouldn't and
talks about other customers' orders. The agent has to improve the assistant's system
prompt in Phoenix and run it as an experiment that the team can compare with the
baseline. The verifier checks that the experiment carries the baseline's evaluations and
that the ones code can check are right. It then runs the assistant with the agent's
saved prompt on 32 new customer questions and checks the replies.

## The request

The agent gets `instruction.md` word for word:

> Our support assistant (`/app/support_app.py`) has been making promises our policies don't allow, and it sometimes discusses other customers' orders. It reads its system prompt from the `support-system` prompt in Phoenix.
>
> Can you improve the prompt so the assistant follows the handbook in `/app/policies.md`? There's a `support-questions` dataset in Phoenix with a `baseline` experiment from the current prompt. Save your improved prompt as a new version of `support-system`, and run it as an experiment on `support-questions` so we can compare its scores with the baseline's.
>
> The prompt has to work on new customer questions too, so don't tune it to the ones in the dataset.

## What the agent starts with

| Where | What |
| --- | --- |
| Prompt `support-system` | One version, the launch prompt. It cites policies only when it turns a request down, has no length limit, tells the assistant to help with orders for "family members, friends, or coworkers", and encourages goodwill discounts and exceptions. |
| Dataset `support-questions` | 30 development questions. Each has the signed-in `customer_id`, the `question`, and `notes` on what a good answer must do. Metadata gives a `case_id` and a `category`: `returns`, `shipping`, `warranty`, `orders`, `pricing`, or `account_access`. |
| Experiment `baseline` | The launch prompt's real replies to all 30 questions, each with four evaluations. `cites_policy` passes 15 of 30, `under_word_limit` 13 of 30, `no_false_promises` 18 of 30, and `account_privacy` 5 of the 10 account questions; it's `not_applicable` on the other 20. 26 of 30 replies fail at least one. Each explanation says how it was decided, such as `95 words; limit 80` or `cited nothing; expected one of ['returns', 'exchanges']`. The evaluators' code isn't on the machine. |
| `/app/support_app.py` | The app. `answer(question, customer_id, prompt=None)` sends the latest `support-system` version to `gpt-5.4-mini`, then one message with the handbook rules, the signed-in customer, their orders and any order the question names, and the question. Passing `prompt` tries a version without saving it. |
| `/app/policies.md` | The handbook: four reply standards and 14 rules. The standards are: cite rules as `[policy:<id>]`, use 80 words or fewer, promise only what the handbook allows, and protect other customers' accounts. The app sends the model the rules but not the standards, so the prompt has to carry them. |
| `/app/orders.json` | 25 customers and 45 orders. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run the app and its own evaluators. |

## How the data was made

Except for the baseline replies, everything is hand-written, with no random seed.
`fixture/build.py` holds the customers, orders, launch prompt, and both sets of
questions with their notes, and `workdir/policies.md` is the handbook. The store,
customers, and orders are invented. No public dataset or user data is used.

The `baseline` experiment replays real `gpt-5.4-mini` replies that
`fixture/record_baseline.py` recorded once and scored with the checks in
`tests/support_checks.py`. Their LLM-judged results came from the verifier's judge at
the time, `gpt-5.6-luna`. `build.py` reads both from `fixture/baseline.json`.

The new questions have hand-written expectations, not class labels: the rules a reply
should cite, whether the question baits a promise the handbook doesn't allow, and for
account questions, whose order it is and which details a reply must not reveal. Each
applies the handbook to the question and to the order records as of 2026-11-10 15:00.
The verifier runs the app with the agent's saved prompt on these questions and grades
the replies with code checks and LLM judges.

Four checks cover the data:

- `build.py` fails on a question it can't grade fairly: a rule the handbook doesn't
  have, a forbidden detail the asking customer can already see, or an order whose owner
  doesn't match the question's privacy type. It also refuses a stale `baseline.json`,
  one recorded with another launch prompt or other development questions.
- The seeder, `environments/fixtures/seed_phoenix.py`, reads each baseline run back and
  fails if an output or evaluation doesn't match the seed file.
- On November 13, 2026, GPT-6 Astra reviewed the questions and expectations read-only
  through Codex. It found that hid-21 expected a refusal without saying when the price
  dropped, and that hid-14 and hid-01 relied on facts their questions didn't state.
  Commit da4416b90c adds those facts to all three questions.
- In Docker, the reference solution scores 1 and a do-nothing agent scores 0. The
  controls under "What the task tests" show what naive approaches score.

## How it's graded

The verifier takes the latest `support-system` version from Phoenix and runs it through
its own copy of the app on 32 new questions. Edits to the agent's copy of the app, or
prompts the agent tried but never saved, don't count. If the prompt is unchanged, the
verifier skips the run and the reply checks fail.

The verifier also grades the agent's experiment: the newest experiment on
`support-questions`, besides `baseline`, with successful runs on at least 80% of the
examples. The request asks for an experiment whose scores the team can compare with the
baseline's, so it has to carry the baseline's four evaluations under the same names,
which is how Phoenix lines experiments up. A result is a score, or a `pass` or `fail` label; a score of 0.5 or more
passes, as on the baseline.

`reward` is 1 only if every check passes.

| Check | Passes when |
| --- | --- |
| `prompt_updated` | The latest `support-system` version differs from the launch prompt. |
| `experiment_recorded` | `support-questions` has an experiment besides `baseline`, with successful runs on at least 80% of its examples. |
| `experiment_evaluations` | The agent's experiment has `cites_policy`, `under_word_limit`, and `no_false_promises` results on at least 80% of its runs, and `account_privacy` results on at least 80% of its runs for the 10 account questions. |
| `experiment_code_checks` | The experiment's two code-checkable evaluations are right on at least 90% of the runs they score. `under_word_limit` agrees with the verifier's word count (80 words or fewer, not counting tags), and `cites_policy` doesn't pass a reply that has no tag or tags a rule the handbook doesn't have. A missing evaluation fails. Code check. |
| `cites_policy` | At least 85% of the 32 replies tag a rule the question depends on, and every tag names a real handbook rule. Code check. |
| `under_word_limit` | At least 85% of the replies are 80 words or fewer, not counting tags. Code check. |
| `no_false_promises` | At least 85% of the replies offer, guarantee, or claim nothing the handbook doesn't allow. An LLM judge decides, with grading notes for each question. |
| `account_privacy` | At least 85% of the 11 account questions get the right handling. For the 7 about someone else's order or account, the reply reveals and changes nothing. For the 4 about the customer's own order, it doesn't hold back. A reply that lists the other customer's details fails outright; otherwise an LLM judge decides. |

The 85% bar comes from local runs. The reference prompt passed every run, and its
lowest rate on any check in any run was 91% (10 of the 11 account questions). In two
runs, the launch prompt scored 59% to 63% on `cites_policy`, 41% to 53% on
`under_word_limit`, 72% to 75% on `no_false_promises`, and 55% to 73% on
`account_privacy`. In the pilot, all four agents' prompts passed every reply check at
91% to 100%. A higher bar would fail the reference too often, so it stays at 85%.

Before trusting the two LLM judges, we checked them on 49 hand-written replies: 32 for
promises and 17 for privacy, about half good and half bad, with similar lengths. They
agreed with every label in three passes.

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `copies_dev_examples`: 1 if the saved prompt quotes 10 or more words in a row from a
  development question or its notes, or names one of their order or customer IDs. Text
  that the new questions, the handbook, or the launch prompt also contain doesn't count.

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Reading the whole handbook, not only the complaint | The request mentions promises and privacy. The citation and length standards appear only in the handbook, the dataset notes, and the baseline evaluations. A prompt that fixes only promises and privacy passes 24 of 32 replies on citations and 20 of 32 on length. |
| Fixing every failing behavior | The launch prompt plus a word limit passes 18 of 32 on citations, 16 of 32 on promises, and 7 of 11 on privacy. |
| Measuring changes with an experiment | `experiment_recorded` fails unless the agent runs its prompt on the dataset. |
| Making the experiment comparable with the baseline | The baseline's evaluators aren't on the machine, so the agent has to read the baseline's evaluations in Phoenix and rebuild them under the same names. An experiment scored with the agent's own evaluators under other names, such as `word_limit` or `matches_notes`, or without `account_privacy`, fails `experiment_evaluations`. |
| Scoring the experiment correctly | `experiment_code_checks` reruns the verifier's own word count and tag check on the experiment's replies and compares them with the experiment's results. |
| Saving the change where the app reads it | The verifier uses the latest Phoenix prompt version, not the agent's files. |
| Writing a prompt that generalizes | The request asks the agent not to tune to the dataset. The new questions include situations the dataset never shows: an order number that belongs to someone else, a cardholder asking about a daughter's account, a neighbor's misdelivered package, a question the handbook doesn't answer, a volunteer discount, and Canada as an allowed destination. |
| Not over-correcting | Four new questions ask about the customer's own order. A prompt that refuses anything about orders fails them. |
| Catching promises that sound helpful | New questions bait discounts, rushed refunds, guaranteed dates, warranty replacements for misuse or other brands, and claims that the assistant cancelled or changed an order itself. |

Controls we ran locally:

| Control | Reward | Failing checks |
| --- | --- | --- |
| Nothing done (nop) | 0 | All |
| Reference solution, three runs | 1, 1, 1 | None |
| Reference prompt, with `account_privacy` scored only on questions that name another customer's order (5 of the 10 account questions) | 0 | `experiment_evaluations` |
| Pilot, Fable with and without skills: their prompts and experiment code replayed | 1 | None |
| Pilot, Haiku with skills: experiment scored with `word_limit`, `valid_policy_tags`, `no_other_customer_data`, and `no_offer_terms` | 0 | `experiment_evaluations`, `experiment_code_checks` |
| Pilot, Haiku without skills: experiment scored with `word_limit`, `cites_policy`, `matches_notes`, `no_other_customer_data`, and `no_leaked_details` | 0 | `experiment_evaluations`, `experiment_code_checks` |

Both Haiku agents passed every reply check. The one with skills noted that its
evaluation names differ from the baseline's; the other added its own evaluators to the
baseline and left out the baseline's three it couldn't see.

These controls replay the baseline's replies into a new experiment, so they make no model
calls. The prompt is unchanged, so `reward` is 0; the table shows the experiment checks.

| Experiment | `experiment_evaluations` | `experiment_code_checks` |
| --- | --- | --- |
| The baseline's four evaluations, copied | Pass | Pass |
| The same results renamed `word_limit`, `matches_notes`, and `no_other_customer_data` | Fail | Fail |
| No `account_privacy` | Fail | Pass |
| `account_privacy` only on questions that name another customer's order | Fail | Pass |
| `under_word_limit` counting characters (agrees on 57% of runs) | Pass | Fail |
| Tags stripped from the replies, and `cites_policy` passing every reply | Pass | Fail |

## Known limits

- The app's model gives different answers on each run, and two checks use an LLM judge.
  A prompt close to the 85% bar can pass one run and fail the next. The reference prompt
  is far above it.
- The app doesn't send the handbook's reply standards to the model, on purpose. With the
  full handbook in front of it, `gpt-5.4-mini` follows the standards no matter what the
  system prompt says, and there'd be nothing to improve.
- `prompt_updated` only checks that the text changed. The run on new questions decides
  whether the change helped.
- The app ignores any model settings saved with the prompt version, so switching models
  in Phoenix has no effect.
- `experiment_code_checks` only catches mistakes on the replies the experiment has. A
  good prompt keeps replies far under 80 words, so a word count that includes tags or
  punctuation still agrees. It catches an evaluator that counts characters, reads the
  wrong field, or passes untagged replies.
- The verifier doesn't check whether the experiment's two LLM-judged evaluations,
  `no_false_promises` and `account_privacy`, are right, only that they're there.
  Checking them would add about 40 model calls to each run.
- Evaluation names must match exactly. An agent that adds its own evaluators to the
  baseline experiment, so that both experiments share them, still fails
  `experiment_evaluations` unless its experiment also carries the baseline's four.
- Each verifier run makes about 75 model calls: 32 to the app's model, 32 to the promise
  judge, and up to 11 to the privacy judge. A run with an unchanged prompt makes none.
  The experiment checks make none.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/phoenix_seed.json` (the prompt, dataset, and baseline experiment), `workdir/orders.json`, `tests/truth.json` (the launch prompt, the 10 development questions about an order or account, and the 32 new questions with grading notes), and `tests/app/`. It's deterministic and makes no model calls. |
| `fixture/record_baseline.py` | Regenerates `fixture/baseline.json`, the saved baseline replies and evaluations, with real model calls. Run it after changing the launch prompt, the app, the development questions, or `tests/support_checks.py`. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `tests/support_checks.py` | The verifier's checks and judge prompts, and the checks on the agent's experiment. |
| `tests/app/` | The verifier's own copy of the app. |
| `solution/improve_prompt.py` | The reference solution. It saves `solution/support_system_v2.txt` as a new `support-system` version, then runs it on `support-questions` with the baseline's four evaluations: two code evaluators and two `gpt-5-nano` judges. `solution/solve.sh` runs it from `/app`. |
