# response-evals

The agent builds one eval for each of the four requirements in a refund bot's reply spec,
logs the results as annotations on 60 production traces, and leaves a script the nightly
job can run on new traces. The task tests whether the agent uses code where code is
enough, gives the grounding judge the evidence it needs, and writes evals that still work
on traces it never saw.

## The request

> Our refund bot has been live for a week. Its traces are in Phoenix under the `refund-bot` project, and the app code and our reply spec (`SPEC.md`) are in `/app`.
>
> Can you set up evals for each requirement in the spec and run them over all the production traces? Log one annotation per requirement on each trace, named with the requirement's ID from the spec and labeled `pass` or `fail`, so we can filter for failures in Phoenix. Put the eval code under `/app/evals/` with an entry point our nightly job can run to score new traces: `python evals/refund_evals.py`. Any LLM-based eval has to use `gpt-5-nano`; it's the only model the nightly job's API key can call.
>
> Then tell me which requirements fail most often.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `refund-bot` | 60 traces with no annotations, one per refund request. The root `support-agent` span holds the customer's message and the bot's JSON reply. Its children are a `get_order` tool call that returns the order record, including `refundable_amount` and the customer's email; a `search_policies` retriever span with 3 policy passages; a `find_similar_tickets` tool call that returns 2 tickets about the same item, each with the reporting customer's email and phone; and the LLM call. |
| `/app/SPEC.md` | The four requirements: `valid_format`, `correct_amount`, `no_pii_leak`, and `grounded`. |
| `/app/refund_bot.py`, `/app/tools.py` | The bot's system prompt, model call, and tool stubs. |
| Environment | `OPENAI_API_KEY`, so the agent can run LLM judges. |

## How the data was made

`fixture/build.py` writes the 60 production traces to the seed file and 40 new traces to
`tests/grading_data.json`. Every reply comes from hand-written parts: 6 policy passages,
10 items with prices, 12 customers, the greeting and claim sentences, the contact
sentences, 10 unsupported claims, and 5 ways to break the format. Each message is a
greeting, then 1 to 3 supported claims and a sentence explaining the refund in shuffled
order, then any contact sentences. The production and new traces use different
wordings for the supported claims and the refund sentence, so a list of production
sentences doesn't carry over to the new traces. No reply comes from a model.

The trace's index sets its customer, item, order ID, similar-ticket contacts, and
timestamps. The random seed, 11 for production traces and 23 for new traces, decides the
rest:

- Which traces fail each requirement, sampled separately for each requirement, so one
  failure doesn't predict another.
- The scenario (unused, damaged, or opened electronics), the days since delivery, and
  whether the customer asks for the item price or the price plus shipping.
- Whether one of the 2 similar tickets is the customer's own earlier ticket, and whether
  the reply repeats the customer's email.
- Which supported claims, contact wording, and third policy passage the trace gets.
- For a failing trace, which unsupported claim replaces a supported one, which wrong
  amount it states, which other customer's contact it leaks, and how its format breaks.

Each label is `pass` unless the generator put that requirement's defect into the reply:

| Requirement | A reply fails when | Production failures | New-trace failures |
| --- | --- | --- | --- |
| `valid_format` | The JSON is wrapped in a fence or followed by text, or the amount is a string such as `"$89.00"`. New traces use a preamble or a plain fence instead of the first two. | 15 of 60 | 10 of 40 |
| `correct_amount` | The amount isn't `refundable_amount`: the item price if unused, the price plus $7.95 shipping if damaged, or 85% of the price if opened. A failing reply states one of the other two amounts. | 18 | 12 |
| `no_pii_leak` | The message includes another customer's email from the similar tickets. In 3 of the 10 new-trace leaks, it's a phone number instead. | 15 | 10 |
| `grounded` | One supported claim is swapped for an unsupported one, such as "We've waived the restocking fee as a courtesy." New traces use 5 different unsupported claims. | 21 | 14 |

`build.py` asserts that the supported production and new-trace sentence sets are
disjoint, and that a code check reproduces each label: a strict JSON parse for
`valid_format`, the reply's amount against `refundable_amount` for `correct_amount`, an
email other than the customer's or any phone number for `no_pii_leak`, and exactly one
sentence from the unsupported-claim list for `grounded`. GPT-6 Astra reviewed the data
and labels. No person has.

## How it's graded

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `production_traces` | Code | `expected.json`, `grading_data.json` | For each requirement, the annotations named with its ID cover at least 95% of the 60 production traces, and they agree with the expected label on at least 90% of passing replies and 90% of failing replies. The bar is 80% for `grounded`. |
| `new_traces` | Code | `expected.json`, `grading_data.json` | After the verifier adds 40 new traces and runs `python evals/refund_evals.py` in `/app` as the agent user, the annotations on the new traces meet the same bars. |

Each check reads the latest annotation with the requirement's name on the trace or any of
its spans. Labels count by meaning, so `true` or `grounded` works as well as `pass`, and a
missing or unclear label counts as wrong. During the rerun, a local proxy records every
model request and refuses any chat model except `gpt-5-nano` with a 403 error. `details.json`
reports each requirement's coverage and recall under each check.

`reward` is 1 only when both checks pass.

These measures are reported beside `reward` and don't affect it:

- `turn_count`: the number of steps in the agent's trajectory.
- `tool_count`: the number of tool calls the agent made.
- `loaded_<skill>`: 1 if the agent loaded that skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of the rerun's judge requests that meet the suite's rubric.
  For this task, the rubric counts `valid_format`, `correct_amount`, and `no_pii_leak` as
  checks code can do, and expects a `grounded` judge to see the order record, the policy
  passages, and the similar tickets.

## What the task tests

| Wrong approach | Fails |
| --- | --- |
| Labeling every trace `pass`. | `production_traces` |
| Comparing the reply's amount with what the customer asked for. The request equals `refundable_amount` on only 24 of 60 traces. | `production_traces` |
| Flagging any email in the message as a leak. 29 of 60 replies repeat the customer's own email, some quoted from the customer's own earlier ticket in the same words leaks use. | `production_traces` |
| Stripping Markdown fences before parsing the reply. | `production_traces` |
| Failing `correct_amount` whenever the JSON doesn't parse strictly, or failing `grounded` when the message shares another customer's contact. The spec says each requirement stands on its own. | `production_traces` |
| A `grounded` judge that sees only the message, or raw span JSON with no app context. On `gpt-5-nano`, the first marks only 13% of grounded replies as grounded, and the second catches 7 of 21 ungrounded ones. | `production_traces` |
| Rules fitted to the production traces: email-only leak detection, a list of the production traces' unsupported claims, or a format check that looks only for `json`-tagged fences and trailing text. | `new_traces` |
| A script that calls a model other than `gpt-5-nano`, hard-codes trace IDs, or doesn't log annotations. | `new_traces` |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Scripted versions of the
wrong approaches above, such as comparing amounts with the customer's request or a
reply-only `grounded` judge, each miss a recall bar and score 0.

## Known limits

- The `grounded` result depends on a `gpt-5-nano` judge, so a script whose recall is near
  the 80% bar can pass in one run and fail in the next.
- The reply about which requirements fail most often isn't graded.
