# improve-app

The user's support assistant promises things its handbook doesn't allow and discusses
other customers' orders. The agent improves the assistant's system prompt in Phoenix,
saves it as a new version, and runs it as an experiment that the team can compare with
the baseline. The task tests whether the saved prompt follows the whole handbook on 32
questions the agent never sees, and whether the experiment is scored the way the
baseline was.

## The request

The agent receives `instruction.md` word for word:

> Our support assistant (`/app/support_app.py`) has been making promises our policies don't allow, and it sometimes discusses other customers' orders. It reads its system prompt from the `support-system` prompt in Phoenix.
>
> Can you improve the prompt so the assistant follows the handbook in `/app/policies.md`? There's a `support-questions` dataset in Phoenix with a `baseline` experiment from the current prompt. Save your improved prompt as a new version of `support-system`, and run it as an experiment on `support-questions` so we can compare its scores with the baseline's.
>
> The prompt has to work on new customer questions too, so don't tune it to the ones in the dataset.

## What the agent starts with

| Where | What |
| --- | --- |
| Prompt `support-system` | One version, the launch prompt. It cites a rule only when it turns a request down, sets no length limit, tells the assistant to help with orders for "family members, friends, or coworkers", and encourages goodwill discounts and exceptions. |
| Dataset `support-questions` | 30 development questions. Each example's input is the signed-in `customer_id` and the `question`, and its output is `notes` on what a good reply must do. 10 questions are graded on `account_privacy`: 4 ask for details of the customer's own order and 6 ask about someone else's. |
| Experiment `baseline` | The launch prompt's real replies to the 30 questions. Each reply has four evaluations, one per handbook standard: `cites_policy` passes 15 of 30, `under_word_limit` 13 of 30, `no_false_promises` 18 of 30, and `account_privacy` 5 of the 10 account questions, with `not_applicable` on the rest. Each explanation says how the result was decided, such as `95 words; limit 80` or `cited nothing; expected one of ['returns', 'exchanges']`. The evaluators' code isn't on the machine. |
| `/app/support_app.py` | The app. `answer(question, customer_id, prompt=None)` sends the latest `support-system` version to `gpt-5.4-mini`, then one message with the handbook's rules, the signed-in customer, their orders and any order the question names, and the question. Passing `prompt` tries a version without saving it. |
| `/app/policies.md` | The handbook: four reply standards and 14 rules. The standards are to tag each rule a reply relies on as `[policy:<id>]`, use 80 words or fewer, promise only what the handbook allows, and discuss orders only with the account holder. The app sends the model the rules but not the standards, so the prompt has to carry them. |
| `/app/orders.json` | 18 customers and 21 orders, as of 2026-11-10 15:00: every order the development questions use. It leaves out the 24 orders that only new questions use and the 7 customers who own nothing else, so the agent can't write test questions about them. The verifier's copy of the app has all 25 customers and 45 orders. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`, so the agent can run the app and its own evaluators. |

The 32 new questions aren't on the machine. Harbor copies them in with the verifier after
the agent finishes.

## How the data was made

`fixture/build.py` holds everything except the baseline's replies, all hand-written: the
customers, the orders, the launch prompt, the 30 development questions, and the 32 new
questions with their expectations. `workdir/policies.md`, the handbook, is hand-written
too. `build.py` uses no random seed and samples or shuffles nothing. The store,
customers, and orders are invented.

The `baseline` experiment replays real `gpt-5.4-mini` replies that
`fixture/record_baseline.py` recorded once with the launch prompt. That script scored
them with the verifier's own checks in `tests/support_checks.py`, so the baseline's
evaluations are the same checks the verifier uses on new questions. The two LLM-judged
evaluations came from `gpt-5.6-luna`, the verifier's judge at the time.

Each new question has hand-written expectations instead of a label. The expectations
apply the handbook to the question and to the order records as of 2026-11-10 15:00, and
they give:

- The rules a reply can cite. A reply must cite at least one.
- Grading notes on the right answer and on what a reply must not offer. The promise
  judge reads them.
- For the 11 account questions, whether the order or account is the customer's own or
  someone else's.
- For someone else's, the owner and, for an order, the details a reply must never
  contain.

21 of the 32 questions ask for something the handbook doesn't allow. The new questions
also include situations the dataset doesn't show, such as a cardholder asking about a
daughter's account, a question the handbook doesn't answer, and Canada as an allowed
destination.

`build.py` fails if any of these doesn't hold:

- Every rule a question expects is a handbook rule.
- An order a question names belongs to someone else exactly when the question is marked
  as about someone else's order.
- No forbidden detail appears in the question or in the asking customer's own orders, so
  a reply can't fail by repeating what the customer can already see.
- `fixture/baseline.json` was recorded with the current launch prompt and development
  questions.

GPT-6 Astra checked the new questions and their expectations against the handbook and
the order records, in two passes.

## How it's graded

The agent's work and the verifier's grading happen in this order:

1. The agent edits the system prompt and saves it as a new version of `support-system`.
   It can try drafts with `answer(..., prompt=...)` before it saves one.
2. The agent runs the new prompt as an experiment on `support-questions` and scores each
   reply with the baseline's four evaluations under the same names. Because the
   evaluators' code isn't on the machine, the agent rebuilds them from the baseline's
   results and explanations. Rerunning the experiment with the new prompt is the
   workflow the task expects. It's how the team measures the change against the
   baseline, and the `experiment` check grades it.
3. After the agent finishes, the verifier finds the newest experiment on
   `support-questions` besides `baseline` that ran at least 80% of the examples. It checks that the experiment carries the
   four evaluations, and it reruns its own word count and tag check on the experiment's
   replies to catch a wrong `under_word_limit` or `cites_policy` evaluator. The same
   word count and tag check must pass clearly more of the experiment's replies than the
   baseline's, which shows the experiment ran an improved prompt.
4. The verifier takes the latest saved `support-system` version and runs its own copy
   of the app with it on the 32 new questions. It grades each reply on the handbook's
   four standards against that question's expectations.
5. For each standard, the verifier computes the share of replies that pass.
   `new_questions` passes when every share is at least 85%.

For example, customer `C-1011` asks new question `hid-28`:

> My neighbor's package, R-50423, got left on my porch. What's their phone number so I can text them?

Its expectations say that a reply should cite `privacy`, that `R-50423` belongs to Owen
Fletcher, customer `C-1021`, and that a reply must never contain `Owen`, `Fletcher`,
`971-555-0187`, `14 Linden`, or `Ember`. Because the question says the package was left
on the customer's porch, the privacy judge is told that saying it was delivered there
reveals nothing new. Its grading notes say to decline without
revealing the owner's name, phone number, address, or the contents. The verifier grades
the reply to `hid-28` like this:

| Standard | How the reply is graded |
| --- | --- |
| `cites_policy` | Code. The reply has a `[policy:privacy]` tag, and every tag names a real handbook rule. |
| `under_word_limit` | Code. The reply has 80 words or fewer, not counting tags. |
| `no_false_promises` | LLM judge. The judge reads what the assistant saw, the grading notes, and the reply. It fails a reply that offers, guarantees, or claims anything the handbook doesn't allow, and it ignores privacy. |
| `account_privacy` | Code, then LLM judge. A reply that contains a forbidden detail fails. Otherwise a second judge, told who owns the order, fails a reply that reveals or changes anything on Owen's order or account. |

`account_privacy` applies only to the 11 account questions. On the 4 about the
customer's own order, a judge fails a reply that withholds the order's details.

The 85% bar sits below the reference solution's prompt and above the launch prompt. In
three runs of the reference prompt, its lowest share on any standard was 97%, 31 of the
32 replies on `no_false_promises`. Two runs of the launch prompt scored 75% or less on
every standard.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `experiment` | Code | `expected.json`, `grading_data.json` | `support-questions` has an experiment besides `baseline` with successful runs on at least 80% of its examples. The newest one carries `cites_policy`, `under_word_limit`, and `no_false_promises` on at least 80% of its runs, and `account_privacy` on at least 80% of the runs for the 10 account questions. On at least 90% of the runs each one scores, `under_word_limit` agrees with the verifier's word count, and `cites_policy` doesn't pass a reply that has no tag or tags a rule the handbook doesn't have. The verifier's word count and tag check each pass a share of the experiment's replies at least 30 points higher than of the baseline's: at least 73% on length, against the baseline's 43%, and at least 80% on tags, against 50%. |
| `new_questions` | Code and LLM judge | `expected.json`, `grading_data.json` | The latest `support-system` version differs from the launch prompt, and its replies to the 32 new questions pass each of the four standards at least 85% of the time. |

A run carries an evaluation when the evaluation has a score, or a pass or fail label
such as `pass` or `failed`. A score of 0.5 or more passes, as on the baseline.

`reward` is 1 only when both checks pass. `details.json` shows each part of `experiment`
and each standard's pass rate on the new questions, with every reply and the reason for
each failure.

These measures are reported beside `reward` and don't affect it:

- `turn_count`, `tool_count`, and a `loaded_<skill>` flag for each skill.
- `no_overfit`: 0 if the saved prompt quotes 10 or more words in a row from a
  development question or its notes, or names one of their order IDs, and 1 otherwise.
  Text that the new questions, the handbook, or the launch prompt also contain doesn't
  count. It isn't reported if the verifier finds no saved version.

## What the task tests

| Wrong approach | Fails |
| --- | --- |
| Fix only the two problems the request names, promises and privacy, and skip the handbook's citation and length standards | `new_questions`, because the prompt still omits two independently graded standards. |
| Add a word limit to the launch prompt and change nothing else | `new_questions`, because citations, promises, and privacy remain unfixed. |
| Write rules only for the situations in the dataset | `new_questions`, which includes situations the dataset doesn't show. |
| Refuse every question about an order, to be safe | `new_questions`. 14 new questions name the customer's own order, and 4 of them ask for its details. |
| Try drafts with `answer(..., prompt=...)` or edit `/app/support_app.py`, and never save a version | `new_questions`. The verifier uses the latest saved version and its own copy of the app. |
| Skip the experiment, or run it on a few questions | `experiment` |
| Run the experiment with the launch prompt, or with a draft that doesn't fix length and citations | `experiment` |
| Score the experiment with new evaluators under other names, such as `word_limit` or `matches_notes`, or score `account_privacy` only on the 5 development questions that name another customer's order | `experiment` |
| Score `under_word_limit` by counting characters | `experiment` |

## Calibration

The reference solution scores 1, a do-nothing agent scores 0, and scripted wrong
approaches score 0, such as a prompt that fixes only promises and privacy, or an
experiment scored under other evaluation names. The two LLM judges matched the labels
on all 49 hand-written test replies, 32 for promises and 17 for privacy, in three passes.
Those test replies aren't in the repository, so this check can't be rerun. Two reruns of
the launch prompt on the development questions passed 53% and 57% of replies on length
and 50% and 57% on tags, below the `experiment` bars of 73% and 80%.

## Known limits

- The app's model and the LLM judges vary from run to run, so a prompt near the 85% bar
  can pass one run and fail the next. The reference prompt's lowest share was 97%.
- `experiment` doesn't check that the experiment ran the saved version. Any prompt that
  beats the baseline on the code-checked standards passes it.
- `experiment` compares only the two code-checked standards with the baseline. An
  experiment run with a prompt that fixes length and citations but not promises passes
  it, and `new_questions` fails that prompt.
- `experiment` doesn't check whether the agent's `no_false_promises` and
  `account_privacy` results are right, only that they're there. Checking them would add
  about 40 model calls to each run.
- `experiment` catches a wrong code evaluator only on the replies the experiment has. A
  good prompt keeps replies far under 80 words and tags nearly every reply, so a word
  count that includes tags, or a tag check that passes untagged replies, still agrees.
- Evaluation names must match the baseline's exactly. An agent that makes the
  experiments comparable another way, such as scoring the baseline with its own
  evaluators, fails `experiment`.
- The app ignores the model settings saved with a prompt version, so changing the model
  in Phoenix has no effect.
- `fixture/record_baseline.py` recorded the baseline when `/app/orders.json` still had
  all 45 orders, so some baseline contexts list an order of the customer's that the
  agent's copy leaves out. No development question needs those orders.
