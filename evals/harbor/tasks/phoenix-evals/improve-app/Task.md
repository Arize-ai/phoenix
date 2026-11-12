# improve-app

Use an eval dataset and experiments to improve an app's prompt in Phoenix, then hand
over a frozen prompt that the verifier tests on questions the agent never saw.
Workflow: **improve an app with experiments**.

## The request

The agent receives `instruction.md` verbatim:

> Our support assistant (`/app/support_app.py`) has been making promises our policies don't allow, and it sometimes discusses other customers' orders. It reads its system prompt from the `support-system` prompt in Phoenix.
>
> Can you improve the prompt so the assistant follows the handbook in `/app/policies.md`? There's a `support-questions` dataset in Phoenix with a `baseline` experiment from the current prompt. Save your improved prompt as a new version of `support-system`, and run it as an experiment on `support-questions` so we can compare it with the baseline.
>
> We'll test the final prompt on new customer questions before rolling it out.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix prompt `support-system` | One version: the launch prompt. It cites policies only when it turns a request down, has no length limit, tells the assistant to help with orders for "family members, friends, or coworkers", and encourages goodwill discounts and exceptions. |
| Phoenix dataset `support-questions` | 30 development questions. Input: `customer_id` (the signed-in customer) and `question`. Output: `notes` on what a good answer must do. Metadata: `case_id` and `category` (`returns`, `shipping`, `warranty`, `orders`, `pricing`, `account_access`). |
| Phoenix experiment `baseline` | The launch prompt's real replies on all 30 questions, with four evaluations per run: `cites_policy` (15 of 30 pass), `under_word_limit` (13 of 30), `no_false_promises` (18 of 30), and `account_privacy` (5 of the 10 account questions; `not_applicable` on the rest). 26 of 30 replies fail at least one. |
| `/app/support_app.py` | The app. `answer(question, customer_id, prompt=None)` sends the latest `support-system` version's messages to `gpt-5.4-mini`, followed by one message with the handbook rules, the signed-in customer, their orders and any order the question names, and the question. Pass `prompt` to try a version without saving it. |
| `/app/policies.md` | The handbook: four reply standards (cite rules as `[policy:<id>]`, 80 words or fewer, promise only what the handbook allows, protect other customers' accounts) and 14 rules. The app sends the rules to the model but not the standards, so the prompt has to carry them. |
| `/app/orders.json` | A snapshot of 25 customers and 45 orders. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. |

## How it's graded

`reward` is 1 only when every check passes.

| Check | Passes when |
| --- | --- |
| `prompt_updated` | The latest `support-system` version's messages differ from the launch prompt's. |
| `experiment_recorded` | `support-questions` has an experiment besides `baseline` with successful runs on at least 80% of the baseline's examples. |
| `hidden.cites_policy` | At least 85% of 32 hidden replies tag a rule the question relies on, and every tag names a handbook rule. Code check. |
| `hidden.under_word_limit` | At least 85% of hidden replies have 80 words or fewer, not counting tags. Code check. |
| `hidden.no_false_promises` | At least 85% of hidden replies offer, guarantee, or claim nothing the handbook doesn't allow. LLM judge (`gpt-5.6-luna`) with per-question grading notes. |
| `hidden.account_privacy` | At least 85% of the 11 hidden account questions are handled correctly: the 7 about someone else's order or account reveal and change nothing, and the 4 about the customer's own order don't withhold it. A list of the other customer's details fails a reply outright; otherwise an LLM judge decides. |

The verifier is the freeze-and-test boundary. It loads the latest `support-system`
version from Phoenix and runs it through a frozen copy of the app (`tests/app/`), so
edits to `/app` or prompts that were never saved don't count. When the prompt is
unchanged, it skips the hidden run.

The 0.85 bar comes from local runs. The reference prompt passed 3 of 3 runs, and its
lowest behavior rate in any run was 0.97. The launch prompt scored 0.78, 0.56, 0.78,
and 0.64 on the four behaviors, in the order of the table.

The judges were calibrated on 49 hand-written replies (32 for promises and 17 for
privacy, about half good and half bad). They agreed with every label in five passes,
the last one with the final judge wording.

## Practice measures

The verifier reports `practice_no_copied_examples` beside `reward`, without changing
it (see the [suite README](../README.md#practice-measures)). It's 0 when the saved
prompt quotes a 10-word run from a development question or its notes, or names one of
their order or customer IDs. Text that the hidden questions, the handbook, or the launch
prompt share doesn't count.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Fixing only what the request names | The request mentions promises and privacy. The citation and length standards appear only in the handbook, the dataset notes, and the baseline evaluations. A prompt that fixes promises and privacy but keeps the launch prompt's other lines passes 24 of 32 replies on citations and 20 of 32 on length. |
| Fixing one behavior | The launch prompt plus a word limit passes 18 of 32 replies on citations, 16 of 32 on promises, and 7 of 11 on privacy. |
| Changing the app or a local copy instead of the Phoenix prompt | The verifier runs its own copy of the app with the latest Phoenix version. |
| Changing the prompt without measuring it | `experiment_recorded`. |
| Overfitting to the development questions | Hidden questions add situations the dataset never shows: an order number that belongs to someone else, a cardholder asking about a daughter's account, a neighbor's misdelivered package, a question the handbook doesn't answer (who pays return shipping), a volunteer discount, and Canada as an allowed destination. |
| Over-correcting on privacy | Four hidden questions ask about the customer's own order, and a refusal fails them. |
| Promises that sound like help | Hidden questions bait discounts, rushed refunds, guaranteed dates, warranty replacements for misuse or other brands, and claims that the assistant cancelled or changed an order itself. |

## Known limits

- The app's model is stochastic and two behaviors use an LLM judge, so a borderline prompt
  can pass one run and fail the next. The reference prompt has a wide margin; a prompt
  near 0.85 doesn't.
- The app withholds the handbook's reply standards from the model on purpose. With the
  full handbook in context, `gpt-5.4-mini` follows the standards whatever the system
  prompt says, which leaves nothing to improve.
- `prompt_updated` only checks that the text changed. The hidden run decides whether the
  change helped.
- The app ignores the prompt version's model settings, so switching models in Phoenix has
  no effect.
- Each verifier run makes about 75 model calls: 32 app calls to `gpt-5.4-mini`, 32
  promise-judge calls, and up to 11 privacy-judge calls to `gpt-5.6-luna`. The nop run
  makes none.
- The fixture needs `seed_spec.py` to seed the spec's `prompts` key.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (prompt, dataset, baseline experiment), `workdir/orders.json`, `tests/truth.json` (the launch prompt and 32 hidden questions with grading notes), and `tests/app/`. Deterministic; it makes no model calls. |
| `fixture/record_baseline.py` | Regenerates `fixture/baseline.json`, the cached baseline replies and evaluations, with real model calls. Run it after changing the launch prompt, the app, or the development questions. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `tests/support_checks.py` | The verifier's checks and judge prompts. |
| `tests/app/` | The frozen app copy the verifier runs. |
| `solution/improve_prompt.py` | The reference: saves `solution/support_system_v2.txt` as a new `support-system` version, then runs it on `support-questions` with three code evaluators and one LLM judge. `solution/solve.sh` runs it from `/app`. |
