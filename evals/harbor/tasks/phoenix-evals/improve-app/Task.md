# improve-app

The user's support assistant breaks its handbook: it makes promises it shouldn't and
talks about other customers' orders. The agent has to improve the assistant's system
prompt in Phoenix, measuring its changes with experiments on a development dataset. The
verifier then runs the assistant with the agent's saved prompt on 32 new customer
questions and checks the replies.

## The request

The agent gets `instruction.md` word for word:

> Our support assistant (`/app/support_app.py`) has been making promises our policies don't allow, and it sometimes discusses other customers' orders. It reads its system prompt from the `support-system` prompt in Phoenix.
>
> Can you improve the prompt so the assistant follows the handbook in `/app/policies.md`? There's a `support-questions` dataset in Phoenix with a `baseline` experiment from the current prompt. Save your improved prompt as a new version of `support-system`, and run it as an experiment on `support-questions` so we can compare it with the baseline.
>
> The prompt has to work on new customer questions too, so don't tune it to the ones in the dataset.

## What the agent starts with

| Where | What |
| --- | --- |
| Prompt `support-system` | One version, the launch prompt. It cites policies only when it turns a request down, has no length limit, tells the assistant to help with orders for "family members, friends, or coworkers", and encourages goodwill discounts and exceptions. |
| Dataset `support-questions` | 30 development questions. Each has the signed-in `customer_id`, the `question`, and `notes` on what a good answer must do. Metadata gives a `case_id` and a `category`: `returns`, `shipping`, `warranty`, `orders`, `pricing`, or `account_access`. |
| Experiment `baseline` | The launch prompt's real replies to all 30 questions, each with four evaluations. `cites_policy` passes 15 of 30, `under_word_limit` 13 of 30, `no_false_promises` 18 of 30, and `account_privacy` 5 of the 10 account questions. 26 of 30 replies fail at least one. |
| `/app/support_app.py` | The app. `answer(question, customer_id, prompt=None)` sends the latest `support-system` version to `gpt-5.4-mini`, then one message with the handbook rules, the signed-in customer, their orders and any order the question names, and the question. Passing `prompt` tries a version without saving it. |
| `/app/policies.md` | The handbook: four reply standards and 14 rules. The standards are: cite rules as `[policy:<id>]`, use 80 words or fewer, promise only what the handbook allows, and protect other customers' accounts. The app sends the model the rules but not the standards, so the prompt has to carry them. |
| `/app/orders.json` | 25 customers and 45 orders. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run the app and its own evaluators. |

## How it's graded

The verifier takes the latest `support-system` version from Phoenix and runs it through
its own copy of the app on 32 new questions. Edits to the agent's copy of the app, or
prompts the agent tried but never saved, don't count. If the prompt is unchanged, the
verifier skips the run and the reply checks fail.

`reward` is 1 only if every check passes.

| Check | Passes when |
| --- | --- |
| `prompt_updated` | The latest `support-system` version differs from the launch prompt. |
| `experiment_recorded` | `support-questions` has an experiment besides `baseline`, with successful runs on at least 80% of its examples. |
| `cites_policy` | At least 85% of the 32 replies tag a rule the question depends on, and every tag names a real handbook rule. Code check. |
| `under_word_limit` | At least 85% of the replies are 80 words or fewer, not counting tags. Code check. |
| `no_false_promises` | At least 85% of the replies offer, guarantee, or claim nothing the handbook doesn't allow. An LLM judge decides, with grading notes for each question. |
| `account_privacy` | At least 85% of the 11 account questions get the right handling. For the 7 about someone else's order or account, the reply reveals and changes nothing. For the 4 about the customer's own order, it doesn't hold back. A reply that lists the other customer's details fails outright; otherwise an LLM judge decides. |

The 85% bar comes from local runs. The reference prompt passed every run, and its
lowest rate on any check in any run was 97%. In two runs, the launch prompt scored 59%
to 63% on `cites_policy`, 41% to 53% on `under_word_limit`, 72% to 75% on
`no_false_promises`, and 55% to 73% on `account_privacy`.

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
| Reading the whole handbook, not just the complaint | The request mentions promises and privacy. The citation and length standards appear only in the handbook, the dataset notes, and the baseline evaluations. A prompt that fixes only promises and privacy passes 24 of 32 replies on citations and 20 of 32 on length. |
| Fixing every failing behavior | The launch prompt plus a word limit passes 18 of 32 on citations, 16 of 32 on promises, and 7 of 11 on privacy. |
| Measuring changes with an experiment | `experiment_recorded` fails unless the agent runs its prompt on the dataset. |
| Saving the change where the app reads it | The verifier uses the latest Phoenix prompt version, not the agent's files. |
| Writing a prompt that generalizes | The request asks the agent not to tune to the dataset. The new questions include situations the dataset never shows: an order number that belongs to someone else, a cardholder asking about a daughter's account, a neighbor's misdelivered package, a question the handbook doesn't answer, a volunteer discount, and Canada as an allowed destination. |
| Not over-correcting | Four new questions ask about the customer's own order. A prompt that refuses anything about orders fails them. |
| Catching promises that sound helpful | New questions bait discounts, rushed refunds, guaranteed dates, warranty replacements for misuse or other brands, and claims that the assistant cancelled or changed an order itself. |

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
- Each verifier run makes about 75 model calls: 32 to the app's model, 32 to the promise
  judge, and up to 11 to the privacy judge. A run with an unchanged prompt makes none.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the prompt, dataset, and baseline experiment), `workdir/orders.json`, `tests/truth.json` (the launch prompt and the 32 new questions with grading notes), and `tests/app/`. It's deterministic and makes no model calls. |
| `fixture/record_baseline.py` | Regenerates `fixture/baseline.json`, the saved baseline replies and evaluations, with real model calls. Run it after changing the launch prompt, the app, or the development questions. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `tests/support_checks.py` | The verifier's checks and judge prompts. |
| `tests/app/` | The verifier's own copy of the app. |
| `solution/improve_prompt.py` | The reference solution. It saves `solution/support_system_v2.txt` as a new `support-system` version, then runs it on `support-questions` with three code evaluators and one LLM judge. `solution/solve.sh` runs it from `/app`. |
