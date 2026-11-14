# response-evals

The user's refund bot has a written reply spec with four requirements. The agent has to
build one eval per requirement, run them over the bot's production traces, and leave a
script the nightly job can run on new traces. The verifier checks the agent's
annotations on the production traces, then runs the script on new traces and checks
those too.

## The request

The agent gets `instruction.md` word for word:

> Our refund bot has been live for a week. Its traces are in Phoenix under the `refund-bot` project, and the app code and our reply spec (`SPEC.md`) are in `/app`.
>
> Can you set up evals for each requirement in the spec and run them over all the production traces? Log one annotation per requirement on each trace, named with the requirement's ID from the spec and labeled `pass` or `fail`, so we can filter for failures in Phoenix. Put the eval code under `/app/evals/` with an entry point our nightly job can run to score new traces: `python evals/refund_evals.py`. Any LLM-based eval has to use `gpt-5-nano`; it's the only model the nightly job's API key can call.
>
> Then tell me which requirements fail most often.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `refund-bot` | 60 traces, one per refund request. The root `support-agent` span has the customer's message and the bot's JSON reply. Its children are a `get_order` tool call (the order record, with the approved `refundable_amount` and the customer's email), a `search_policies` retriever with 3 policy passages, a `find_similar_tickets` tool call (2 tickets about the same item, each with the reporting customer's email and phone), and the LLM call. In 24 traces, one of those tickets is the customer's own earlier ticket. |
| `/app/SPEC.md` | Four requirements: `valid_format`, `correct_amount`, `no_pii_leak`, and `grounded`. |
| `/app/refund_bot.py`, `/app/tools.py` | The bot's prompt, model call, and tools, for context. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run LLM evaluators. |

No labels are visible. Each requirement fails on 25% to 35% of traces, chosen
independently, so one failing requirement doesn't predict another.

## How it's graded

`reward` is 1 only if every check passes. Each check reads the latest annotation named
after a requirement on each trace. It passes when those annotations cover at least 95%
of the traces, and they catch enough of the passing replies and enough of the failing
ones. Checking each class separately means a constant label fails. Labels count by
meaning, so `true` or `grounded` works as well as `pass`.

| Check | Which traces | What passes |
| --- | --- | --- |
| `production_valid_format`, `production_correct_amount`, `production_no_pii_leak`, `production_grounded` | The 60 production traces. | At least 90% recall on each class, or 80% for `grounded`. |
| `new_traces_valid_format`, `new_traces_correct_amount`, `new_traces_no_pii_leak`, `new_traces_grounded` | 40 new traces the verifier adds. It then runs `python evals/refund_evals.py` as the agent user. | The same. |

The reply about which requirements fail most isn't graded.

During the rerun, every model request goes through a local recorder. It refuses any
model except `gpt-5-nano` with a 403, the way the nightly key would. A small model
like this one gets `grounded` right only when the prompt is clear and carries the right
evidence. With the reference prompt it reaches at least 95% recall on every check. A naive
`grounded` prompt that pastes raw span JSON, gives no app context, and doesn't say what
counts as a claim catches only 3 of the 21 ungrounded production replies.

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of judge requests whose prompt meets the rubric. For this
  task, the rubric grader knows what each requirement needs:

| Requirement | Evidence a judge needs | Can code check it? |
| --- | --- | --- |
| `valid_format` | The raw reply text. | Yes |
| `correct_amount` | The reply's refund amount and the order record's `refundable_amount`. | Yes |
| `no_pii_leak` | The reply and the customer's own email from the order record. | Yes |
| `grounded` | The reply, plus everything the bot looked up: the order record, the policy passages, and the similar tickets. | No |

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Using code where code is enough | Three of the four requirements are exact checks. An LLM judge on `gpt-5-nano` is slower and less reliable on them, and `prompt_quality` reports it. |
| Checking the amount against the order, not the request | Customers ask for the item price or the price plus shipping, whatever they're owed. The request matches `refundable_amount` on only 24 of 60 traces, so only the order record decides `correct_amount`. |
| Keeping requirements separate | Fenced or prefixed JSON fails `valid_format` but can still pass `correct_amount`. A reply that shares another customer's contact from the similar tickets is grounded but fails `no_pii_leak`. |
| Knowing what counts as a leak | 48% of replies repeat the customer's own email, which is allowed. Some quote it from the customer's own earlier ticket, in the same words that leaking replies use for another customer's contact. Only whose contact it is decides the label. |
| Giving the grounding judge the evidence | Every reply cites order facts and policy passages that only the child spans contain. A judge that sees only the reply can't tell supported claims from made-up ones. |
| Writing a script that generalizes | New traces have unsupported claims, leak formats such as phone numbers, and broken formats that the production traces never show. |
| Leaving a script the nightly job can run | The rerun fails if the entry point is missing, hard-codes trace IDs, or doesn't log annotations. |

## Known limits

- The replies come from templates. The new traces' different wording limits how far
  pattern matching gets.
- Each label is correct by construction, because the generator inserts each defect on
  purpose. Where exactly `grounded` draws the line still depends on how a judge reads
  "backed by". The reference judge sets the practical bar.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 60 production traces) and `tests/truth.json` (their labels, plus the 40 new traces and their labels). It's deterministic; rerun it after editing. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `solution/refund_evals.py` | The reference evals: code checks for three requirements and an LLM judge for `grounded`. `solution/solve.sh` installs it as the nightly entry point and runs it. |
