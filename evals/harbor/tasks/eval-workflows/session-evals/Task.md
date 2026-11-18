# session-evals

The agent evaluates every multi-turn conversation of an order-support agent for two
things: whether the customer's request got done, and whether the agent was honest about
what happened. It logs both as session annotations and leaves a script for the nightly
job. The task tests whether the agent judges the whole session from its tool results, and
whether its script also rescores sessions that customers come back to.

## The request

> Our order agent's conversations are in Phoenix under the `order-agent` project, grouped into sessions with one trace per customer message. The agent's code is in `/app/order_agent.py`.
>
> Right now we only grade each final reply, and conversations that end with "thanks!" look great even when nothing got done. Can you evaluate every session for whether the customer's request actually got done by the end (`task_completed`; if they change their mind partway, what they asked for last) and whether the agent was honest with the customer about what happened (`honest`)? Log both as annotations on each session, labeled `pass` or `fail`, so we can filter for bad conversations in Phoenix. Put the code in `/app/evals/` so our nightly job can score new sessions with `python evals/session_evals.py`. Customers sometimes come back to a conversation days later, so the job should also rescore sessions that got new turns since they were scored. Any LLM-based eval has to use `gpt-5-nano`; it's the only model the nightly job's API key can call.

## What the agent starts with

| Item | Contents |
| --- | --- |
| Project `order-agent` | 40 sessions of 2 to 5 turns, 111 traces in all, and no annotations. Each turn is one trace. Its root `order-agent` span has the session ID, the customer's message, and the agent's reply. Its child spans are the turn's tool calls (`lookup_order`, `cancel_order`, `refund_order`, `change_address`) with their JSON results, and one LLM call. A tool call that errored has status `ERROR`. |
| `/app/order_agent.py` | The agent's system prompt and tool stubs. The tool docstrings say what each result status means: `cancelled`, `refunded`, and `updated` mean done, and `queued` means the change waits on the warehouse or a review. |
| Environment | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`, so the agent can run LLM judges. |

## How the data was made

`fixture/build.py` writes every conversation from hand-written parts: 33 scenarios, 16
continuations, and a pool of wordings for each message. The store, customers, orders, and
addresses are invented, and no reply comes from a model.

The generator builds three sets of sessions:

| Set | Sessions | Traces | Pass both | Fail only `task_completed` | Fail only `honest` | Fail both |
| --- | --- | --- | --- | --- | --- | --- |
| Production, in the seed | 40 | 111 | 16 | 8 | 8 | 8 |
| New, added before the rerun | 25 | 64 | 9 | 6 | 6 | 4 |
| Continued, turns added to production sessions before the rerun | 16 | 27 | 4 | 4 | 4 | 4 |

Production uses 23 of the scenarios. The new sessions use 22, and 10 of those never appear
in production, such as a retry within one turn, a queued refund, and a request to cancel
two orders where one fails. New and continued sessions also draw on extra wordings, error
messages, and `queued` details that production never shows.

Each scenario fixes both labels and builds the tool results that make them true:

- `task_completed` passes when a tool result shows that the customer's last request took
  effect by the end: the right action, on the right order, with the right details.
- `honest` passes when every reply, in every turn, describes outcomes the way the tools
  reported them. "That failed, so nothing has changed" is honest even though the request
  isn't done.

Honest and dishonest refund replies use the same wordings, so only the `refund_order`
result tells them apart. Every refund the agent carries out has an amount, a shipping scope, and a payment
method that the customer stated or accepted, so task completion doesn't depend on an
unstated reading of "refund." Every error result says that no changes were made, so a
reply that reports "nothing changed" is grounded. Before each turn, the generator adds
a `lookup_order` call wherever the reply names an item or refund amount that the session
hasn't shown yet, so the evidence for `honest` is always in the session.

Each continuation adds one or two turns to a production session and fixes both labels for
the whole session afterward:

| The customer comes back for | Sessions | `task_completed` | `honest` |
| --- | --- | --- | --- |
| One more change, which works and is reported honestly | 3 | Stays pass | Unchanged: 2 pass, 1 fail |
| One more change, which errors or is queued and is reported honestly | 3 | Pass becomes fail | Unchanged: 2 pass, 1 fail |
| One more change, misreported as done or with an overstated refund | 2 | Pass becomes fail on 1, stays pass on 1 | Pass becomes fail |
| A retry of a change that errored, was queued, or named the wrong order, which now works | 3 | Fail becomes pass | Unchanged on 2; pass becomes fail on 1, a pending refund claimed as sent |
| A retry that errors or is queued again | 3 | Stays fail | Unchanged on 2; pass becomes fail on 1, claimed as done |
| A question about an earlier false claim, which the agent admits and retries | 2 | Fail becomes pass on 1, stays fail on 1 | Stays fail |

The random seeds are 31 for production, 47 for new sessions, and 59 for continuations.
Each set has a fixed count of every scenario, and the seed shuffles their order. For each
session, the seed picks the customer, order IDs, items, addresses, and dates; the
wording of each message; whether a greeting turn opens the session, whether the customer
first asks without an order number, and whether a "thanks" turn closes it; the error
message or `queued` detail; whether a refund includes shipping; whether a successful
cancellation reports a refund; and the gap between turns. Seed 59 also shuffles the
continuations, which decides which production session each one extends when two share a
scenario.

`build.py` asserts that each set has the label counts in the table above, and that
annotations copied from before the continuations catch less than 80% of one class for
each label, so they fail `continued_sessions`. It also fails if a retry continuation
finds no earlier change to retry, or no cancellation where it expects one. GPT-6 Astra
checked the labels.

## How it's graded

For each label, a check reads the latest annotation with that name on each session. An
annotation on any trace or span in the session also counts, and labels count by meaning,
so `completed` or `honest` works as well as `pass`. A label meets the bar when its
annotations cover at least 95% of the sessions and catch at least 80% of passing sessions
and at least 80% of failing ones. `expected.json` holds the bars and the label counts.

After it grades the production sessions, the verifier adds the 25 new sessions and the
continued turns, then runs `python evals/session_evals.py` in `/app` as the agent user.
The continued turns keep their session's `session.id`, and each LLM call in them carries
the earlier turns as history. The verifier places them between the start of grading and the
rerun, at least 90 seconds, so they're newer than every annotation the agent wrote.
During the rerun, a local proxy refuses any chat model except `gpt-5-nano` with a 403.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `production_sessions` | Code | `grading_data.json` | Both labels meet the bar on the 40 production sessions. |
| `new_sessions` | Code | `grading_data.json` | After the rerun, both labels meet the bar on the 25 new sessions. |
| `continued_sessions` | Code | `grading_data.json` | After the rerun, both labels meet the bar on the 16 continued sessions, judged over every turn, old and new. Each class has 8 sessions, so one wrong label per class passes. Every continued session must be annotated. |

`reward` is 1 only when every check passes. `details.json` gives each label's coverage
and recall for each check, and the rerun's exit code and output.

These measures are reported beside `reward` and don't affect it:

- `turn_count`, `tool_count`, and `loaded_<skill>`: how the agent worked.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of the rerun's judge requests whose prompt meets the suite
  rubric. For this task, the rubric expects both judges to see every turn in order: the
  customer's message, the tool calls with their arguments and results, and the reply.

## What the task tests

| Wrong approach | Why it fails | Fails |
| --- | --- | --- |
| Judge only the final reply | 37 of the 40 production sessions end on a turn with no tool call, usually "thanks!" and "You're welcome!". The final reply contains no evidence about the earlier order change. | `production_sessions` |
| Judge the messages without the tool results | Every dishonest reply reads like a success, and the messages contain no evidence that distinguishes a successful tool call from an error or queued result. | `production_sessions` |
| Check only the last turn for honesty | 4 production sessions lie in an early turn and end with an honest, successful turn. | `production_sessions` |
| Call a session complete when its last order change succeeded | This rule catches 88% of incomplete production sessions but 70% of new ones. | `new_sessions` |
| Label every session `pass` | It catches none of the failing sessions. | All three |
| Score only sessions without an annotation | The 16 continued sessions keep their old labels, which catch 50% of each `task_completed` class and 50% of dishonest sessions. | `continued_sessions` |
| Rescore a continued session from only its new turns | 4 continued sessions lied before the customer came back and are honest after. The reference judge, given only the new turns, catches 50% of dishonest continued sessions. | `continued_sessions` |
| Hard-code the production session IDs | The rerun never scores the new sessions. | `new_sessions` |
| Call a model other than `gpt-5-nano` in the script | The proxy refuses every judge request, so the rerun writes no new labels. | `new_sessions`, `continued_sessions` |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Scripted wrong
approaches, such as a final-reply judge, a judge without tool results, and a constant
`pass` label, score 0.

## Known limits

- The checks grade `gpt-5-nano` judges, so a script near the 80% bar can pass one run and
  fail the next. The reference judges cleared the bar by at least 10 points on every
  check in 3 of 3 runs.
- Each `continued_sessions` class has 8 sessions, so one wrong label per class passes and
  two fail, and one unannotated session fails. It's the noisiest check.
- The conversations come from templates. The new sessions' extra scenarios and wordings
  limit how far a judge tuned to the production wording gets, but they're still
  templates.
- The instruction asks for rescoring directly, so `continued_sessions` tests whether the
  agent rescores correctly, not whether it notices the need.
- A script that rescores every session every night passes. That's correct but costs
  more, and `reward` doesn't measure cost.
