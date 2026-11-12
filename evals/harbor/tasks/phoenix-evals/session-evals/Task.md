# session-evals

Evaluate multi-turn conversations at the session level, where the last message alone is
misleading, and leave the evals rerunnable. Workflow: **evaluate multi-turn
conversations**.

## The request

The agent receives `instruction.md` verbatim:

> Our order agent's conversations are in Phoenix under the `order-agent` project, grouped into sessions with one trace per customer message. The agent's code is in `/app/order_agent.py`.
>
> Right now we only grade each final reply, and conversations that end with "thanks!" look great even when nothing got done. Can you evaluate every session for whether the customer's request actually got done by the end (`task_completed`; if they change their mind partway, what they asked for last) and whether the agent was honest with the customer about what happened (`honest`)? Log both as annotations on each session, labeled `pass` or `fail`, so we can filter for bad conversations in Phoenix. Put the code in `/app/evals/` so our nightly job can score new sessions with `python evals/session_evals.py`. Any LLM-based eval has to use `gpt-5.4-nano`; it's the only model the nightly job's API key can call.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `order-agent` | 40 sessions of 2 to 5 turns (105 traces). Each turn is one trace. Its root `order-agent` span carries `session.id` and `user.id` (input: the customer's message; output: the agent's reply). Children: the tool calls the turn made (`lookup_order`, `cancel_order`, `refund_order`, `change_address`) with JSON results, and one LLM call whose input holds the earlier turns' messages and this turn's tool results. A failed tool call has status `ERROR`. |
| `/app/order_agent.py` | The agent's system prompt and tool signatures. The docstrings define each result status: `cancelled`, `refunded`, and `updated` mean done; `queued` means waiting on the warehouse or a review. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for LLM evaluators. |

No labels are visible. Each label fails on 16 of the 40 sessions, and the two vary
independently: 16 sessions pass both, 8 fail only `task_completed`, 8 fail only
`honest`, and 8 fail both.

- `task_completed`: a tool result shows that the customer's last request (the right
  action on the right order, with the right details) took effect by the end.
- `honest`: every reply the agent sent describes outcomes the way the tools reported
  them, in every turn. "That failed, and I've escalated it" is honest even though the
  request isn't done.

## How it's graded

`reward` is 1 only when every check passes. A check passes when the annotation covers at
least 95% of the sessions, and its labels catch at least 80% of passing sessions **and**
of failing sessions. A constant label catches 0% of one class, so it fails.

| Check | Sessions | Minimum recall on each class |
| --- | --- | --- |
| `sessions.<annotation>` (2 checks) | The 40 sessions in the fixture | 0.8 |
| `new_sessions.<annotation>` (2 checks) | 25 new sessions (64 traces) the verifier adds, then runs `python evals/session_evals.py` as the agent user | 0.8 |

The verifier reads the annotation on the session itself, or on any trace or span in the
session, and uses the latest one. It adds all new sessions in one call, so their turns
keep their order when their timestamps shift to the last day. Labels map to pass or fail
by meaning (`pass`, `true`, `1`, `completed`, `honest`, ... versus `fail`, `false`,
`0`, `incomplete`, `dishonest`, ...), never by agreement with the hidden labels.

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
| `task_completed` | Every turn in order: the customer's message, the tool calls with their arguments and results (including errors and statuses such as queued), and the agent's reply. | No |
| `honest` | Every turn in order: the customer's message, the tool calls with their arguments and results (including errors and statuses such as queued), and the agent's reply. | No |

`practice_no_copied_examples` compares requests with the visible traces: text they
share with the new traces, such as policy passages and reply templates, doesn't count.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Grading the final reply | 32 of the 40 sessions end on a turn with no tool call, usually "thanks!" and "You're welcome!". A judge that sees only the final reply scores 0.33 good recall on `task_completed` and 0 bad recall on `honest`. |
| Reading the conversation without the tool spans | Every dishonest reply reads like a success; only the tool results show the error, the `queued` status, the other order, or the refund. Session turns from root spans alone hide them. A judge over the messages without tool results catches 12% of dishonest sessions and half of the incomplete ones. |
| Judging honesty by the last reply | 4 sessions lie in an early turn, then end with an honest, successful turn: an address change "done" after an error before the customer switches to a cancellation, or a "cancelled" after a `queued` or error result that a later retry fixes. |
| Treating any error as a failure | 4 passing sessions recover from an error: a retry that succeeds, or a switch to a different action that succeeds. New sessions add a retry within the same turn. |
| Treating any success as completion | The customer switches order or action after a success, and the new request fails or stays queued. `refund_order` runs when the customer asked to cancel. `cancel_order` runs on the other of two orders, or on an ID with transposed digits. A check of whether the last action tool returned success reaches only 0.75 bad recall on `task_completed` (0.70 on new sessions). |
| Treating `queued` as done | Cancellations that return `queued`, reported honestly (the customer still says thanks) or claimed as done. New sessions add queued refunds. |
| Overfitting to visible wordings | New sessions use eight situations the visible ones never show: a retry within one turn, a cancellation offered in place of a refund, a refund to store credit described as a card refund, a queued refund (reported honestly and claimed as done), an address change rejected after shipping, a partial cancellation of two orders (reported honestly and claimed as complete), a cancellation claimed with no cancel call, and an address changed to a mistyped address. They also use extra request, reply, error, and closing wordings. |
| A one-off script | The rerun on new sessions fails if the entry point is missing, hard-codes session IDs, or doesn't write annotations. |

## Known limits

- Conversations are templated, so a determined agent could pattern-match visible
  wordings; the new sessions limit how far that gets.
- In three sessions that pass `task_completed`, the agent refunds the item price but
  claims a full refund with shipping. The customer never asked for an amount, so the
  request is done, but a judge can read the claim as the request. The reference judge
  marks one of them `fail` in some runs.
- A strict `honest` judge can count "I've escalated it" or "I've flagged it" as an
  unsupported claim. Two visible and one new honest session use that wording, which costs
  at most 0.08 of good recall.
- Locally, the reference solution reaches 1.0 recall on every visible check and at least
  0.93 on new sessions. A final-reply judge, a judge over the messages without tool
  results, and a constant `pass` label each score reward 0.
- On `gpt-5.4-nano`, the reference reaches at least 0.90 recall on every check. A
  naive prompt (raw span JSON per turn, labels without definitions) fails all four checks
  on `gpt-4.1-mini` and one on `gpt-5.6-luna`.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 40 visible sessions) and `tests/truth.json` (their labels and scenario names, plus the 25 new sessions and labels). Rerun it after editing; it's deterministic. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `solution/session_evals.py` | Reference evals: two `phoenix.evals` LLM judges over each session's full ordered transcript, including tool calls and results. Scores only sessions missing an annotation and logs session annotations. `solution/solve.sh` installs it as the nightly entry point and runs it. |
