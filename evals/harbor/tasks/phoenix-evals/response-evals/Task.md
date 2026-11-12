# response-evals

Build one eval per requirement of a written spec, run it on production traces, and leave
it rerunnable. Workflow: **build evals for an app**.

## The request

The agent receives `instruction.md` verbatim:

> Our refund bot has been live for a week. Its traces are in Phoenix under the `refund-bot` project, and the app code and our reply spec (`SPEC.md`) are in `/app`.
>
> Can you set up evals for each requirement in the spec and run them over all the production traces? Log one annotation per requirement on each trace, named with the requirement's ID from the spec and labeled `pass` or `fail`, so we can filter for failures in Phoenix. Put the eval code under `/app/evals/` with an entry point our nightly job can run to score new traces: `python evals/refund_evals.py`. Any LLM-based eval has to use `gpt-5.4-nano`; it's the only model the nightly job's API key can call.
>
> Then tell me which requirements fail most often.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `refund-bot` | 60 traces, one per refund request. Root `support-agent` span (input: customer message; output: the bot's JSON reply). Children: `get_order` tool (order record with the approved `refundable_amount` and the customer's email), `search_policies` retriever (3 policy passages), `find_similar_tickets` tool (2 other customers' tickets with their email and phone), and the LLM call. |
| `/app/SPEC.md` | Four requirements: `valid_format`, `correct_amount`, `no_pii_leak`, `grounded`. |
| `/app/refund_bot.py`, `/app/tools.py` | The app's prompt, model call, and tool signatures, for context. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for LLM evaluators. |

No labels are visible. Each requirement fails on 25 to 35% of traces, chosen
independently, so no requirement predicts another.

## How it's graded

`reward` is 1 only when every check passes. A check passes when the annotation named
after the requirement covers at least 95% of the traces, and its labels catch at least
the stated share of passing replies **and** of failing replies. A constant label
catches 0% of one class, so it fails.

| Check | Traces | Minimum recall on each class |
| --- | --- | --- |
| `production.<requirement>` (4 checks) | The 60 traces in the fixture | 0.9; 0.8 for `grounded` |
| `new_traces.<requirement>` (4 checks) | 40 new traces the verifier adds, then runs `python evals/refund_evals.py` as the agent user | Same |

The verifier reads annotations on any span of a trace, or on the trace itself, and
uses the latest one. Labels map to pass or fail by meaning (`pass`, `true`, `1`,
`grounded`, ... versus `fail`, `false`, `0`, `ungrounded`, ...), never by agreement with
the hidden labels. The final reply isn't graded.

The request pins LLM judges to `gpt-5.4-nano`, a small model that rewards a clear
prompt with the right evidence. During the rerun, model requests go through a recorder
that refuses any other model with a 403, as the nightly job's key would, so a script
that calls another model fails the new-trace checks. The reference solution passes on
`gpt-5.4-nano` (see Known limits).

## Practice measures

The verifier records the requests the rerun sends to model providers and reports
`practice_*` scores beside `reward`, without changing it (see the
[suite README](../README.md#practice-measures)). The rubric grader reads this task's
criteria with the evidence each one needs, and whether code can check it without a
model:

| Criterion | Evidence a judge needs | Code can check it |
| --- | --- | --- |
| `valid_format` | The raw reply text. | Yes |
| `correct_amount` | The reply's refund amount and the order record's refundable_amount. | Yes |
| `no_pii_leak` | The reply message and the customer's own email from the order record. | Yes |
| `grounded` | The reply message, plus everything the bot looked up: the order record, the policy search results, and the similar-ticket results. | No |

`practice_no_copied_examples` compares requests with the visible traces: text they
share with the new traces, such as policy passages and reply templates, doesn't count.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Checking the amount against what the customer asked for | The customer always asks for item price plus shipping; that's right only for damaged items. |
| Strict JSON parsing for every requirement | Fenced or prefixed JSON must fail `valid_format` but can still pass `correct_amount`. |
| Flagging any email as a leak | 40% of replies repeat the customer's own email, which is allowed. |
| Judging grounding without the tool results | Every reply cites order facts and policy passages that only the child spans contain. |
| Letting one requirement leak into another | A reply that shares another customer's contact, taken from the similar-ticket results, is grounded but fails `no_pii_leak`. LLM judges tend to call the disclosure unsupported; the reference judge drops sentences with contact details before judging support. |
| Overfitting to visible wordings | New traces use unsupported claims, leak formats (phone numbers), and broken formats the 60 visible traces never show. |
| A one-off script | The rerun on new traces fails if the entry point is missing, hard-codes trace IDs, or doesn't write annotations. |

## Known limits

- Replies are templated, so a determined agent could pattern-match visible wordings; the
  new traces limit how far that gets.
- Labels are correct by construction (each defect is inserted deliberately), but the
  `grounded` boundary depends on the judge's reading of "backed by". The reference
  solution's LLM judge sets the practical bar; see the local and oracle results.
- On `gpt-5.4-nano`, the reference reaches 1.0 recall on every check. A naive
  `grounded` prompt (raw span JSON, no app context, no definition of a claim) catches 0
  of 21 visible ungrounded replies on `gpt-5.4-nano` and 1 of 21 on `gpt-4.1-mini`. The
  reference prompt on `gpt-4.1-mini` catches 12 of 14 new ungrounded replies, so
  `gpt-4.1-mini` would leave too little margin.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 60 visible traces) and `tests/truth.json` (their labels, plus the 40 new traces and labels). Rerun it after editing; it's deterministic. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `solution/refund_evals.py` | Reference evals: code checks for three requirements, an LLM judge for `grounded`. `solution/solve.sh` installs it as the nightly entry point and runs it. |
