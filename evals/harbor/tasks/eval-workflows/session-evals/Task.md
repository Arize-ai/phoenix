# session-evals

The user's order-support agent has multi-turn conversations, and grading only the final
reply makes them look fine. The agent has to evaluate each whole session for two things:
whether the customer's request got done, and whether the agent was honest about what
happened. It logs both as session annotations and leaves a script for the nightly job.
The verifier checks the annotations, then adds new sessions and new turns to sessions the
agent already scored, and runs the script. Customers come back to old conversations, so
the script has to rescore those sessions, not only score new ones.

## The request

The agent gets `instruction.md` word for word:

> Our order agent's conversations are in Phoenix under the `order-agent` project, grouped into sessions with one trace per customer message. The agent's code is in `/app/order_agent.py`.
>
> Right now we only grade each final reply, and conversations that end with "thanks!" look great even when nothing got done. Can you evaluate every session for whether the customer's request actually got done by the end (`task_completed`; if they change their mind partway, what they asked for last) and whether the agent was honest with the customer about what happened (`honest`)? Log both as annotations on each session, labeled `pass` or `fail`, so we can filter for bad conversations in Phoenix. Put the code in `/app/evals/` so our nightly job can score new sessions with `python evals/session_evals.py`. Customers sometimes come back to a conversation days later, so the job should also rescore sessions that got new turns since they were scored. Any LLM-based eval has to use `gpt-5-nano`; it's the only model the nightly job's API key can call.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `order-agent` | 40 sessions of 2 to 5 turns, 116 traces in all. Each turn is one trace. Its root `order-agent` span has the session ID, the customer's message, and the agent's reply. Its children are the turn's tool calls (`lookup_order`, `cancel_order`, `refund_order`, `change_address`) with their JSON results, and one LLM call. A failed tool call has status `ERROR`. |
| `/app/order_agent.py` | The agent's system prompt and tools. The docstrings say what each result status means: `cancelled`, `refunded`, and `updated` mean done, and `queued` means waiting on the warehouse or a review. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run LLM evaluators. |

No labels are visible. Each label fails on 16 of the 40 sessions, and the two vary
independently: 16 sessions pass both, 8 fail only `task_completed`, 8 fail only
`honest`, and 8 fail both.

- `task_completed` passes when a tool result shows that the customer's last request took
  effect by the end: the right action, on the right order, with the right details.
- `honest` passes when every reply the agent sent, in every turn, describes outcomes the
  way the tools reported them. "That failed, so nothing has changed" is honest even though
  the request isn't done.

## How it's graded

`reward` is 1 only if every check passes. Each check reads the latest annotation with
that name on each session. It passes when those annotations cover at least 95% of the
sessions, and they catch at least 80% of the passing sessions and at least 80% of the
failing ones. Checking each class separately means a constant label fails. The verifier
also accepts an annotation on any trace or span in the session. Labels count by meaning,
so `completed` or `honest` works as well as `pass`.

| Check | Which sessions | What passes |
| --- | --- | --- |
| `production_task_completed`, `production_honest` | The 40 sessions in the project. | At least 80% recall on each class. |
| `new_sessions_task_completed`, `new_sessions_honest` | 25 new sessions (64 traces) the verifier adds. It then runs `python evals/session_evals.py` as the agent user. | At least 80% recall on each class. |
| `continued_sessions_task_completed`, `continued_sessions_honest` | 16 of the production sessions, after the verifier adds 27 new turns to them before the same rerun. Their labels cover every turn, old and new. | At least 80% recall on each class. Each label passes on 8 of these sessions and fails on 8, so one miss per class is allowed. |

During the rerun, every model request goes through a local recorder. It refuses any
model except `gpt-5-nano` with a 403, the way the nightly key would. A small model
like this one gets these labels right only when the prompt is clear and carries the
right evidence. With the reference prompt it reaches at least 90% recall on every check,
and 100% on both continued checks.
A naive prompt that pastes raw span JSON for each turn and doesn't define the labels
catches only 62% of incomplete production sessions.

### Continued sessions

Before the rerun, the verifier adds one or two turns to 16 production sessions. The
customer comes back days later with one more request, asks to retry a change that didn't
work, or asks about an earlier claim. The new turns keep the session's `session.id`, and
each LLM call in them carries the earlier turns as history.

| The customer comes back for | Sessions | `task_completed` | `honest` |
| --- | --- | --- | --- |
| One more change, which works and is reported honestly | 3 | pass stays pass | unchanged (2 pass, 1 fail) |
| One more change, which errors or is queued and is reported honestly | 3 | pass becomes fail | unchanged (2 pass, 1 fail) |
| One more change, misreported: a failed cancellation claimed as done, or a refund amount overstated | 2 | pass becomes fail (1), stays pass (1) | pass becomes fail |
| A retry of a change that errored, was queued, or named the wrong order number, which now works | 3 | fail becomes pass | unchanged (2), pass becomes fail (1, a pending refund claimed as sent) |
| A retry that errors or is queued again | 3 | fail stays fail | unchanged (2), pass becomes fail (1, claimed as done) |
| A question about an earlier false claim. The agent admits it and tries again, which works once and errors once. | 2 | fail becomes pass (1), stays fail (1) | fail stays fail |

So `task_completed` changes on 8 of the 16 sessions, 4 each way, and `honest` changes on
4. An annotation from before the continuation catches 50% of one class for each label.

The new turns have to be newer than every annotation the agent wrote, or a script that
compares a session's latest turn with its annotations couldn't tell them apart. So the
verifier notes the time it starts, which is after the agent finished, and places the new
turns between then and the rerun. It waits until at least 90 seconds have passed, so the
turns spread over about 90 seconds and keep their order within each session. They also
start in the last 6 hours, like the rest of the new traffic.

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of judge requests whose prompt meets the rubric. For this
  task, the rubric grader knows that both judges need every turn in order: the
  customer's message, the tool calls with their arguments and results (including errors
  and statuses such as `queued`), and the agent's reply. Neither can be checked by code
  alone.

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Judging the whole session, not the last reply | 35 of the 40 sessions end on a turn with no tool call, usually "thanks!" and "You're welcome!". A judge that sees only the final reply catches 13% of completed sessions. |
| Giving the judge the tool results | Every dishonest reply reads like a success. Only the tool results show the error, the `queued` status, the wrong order, or a refund amount, method, or status that differs from what the reply says. Honest and dishonest replies use the same refund wording, so the reply alone can't decide. A judge that sees only the messages catches 12% of dishonest sessions. |
| Checking every turn for honesty | 4 sessions lie in an early turn and end with an honest, successful turn. |
| Not treating every error as failure | 4 passing sessions recover from an error, with a retry or a switch to another action that works. |
| Not treating every success as done | The customer changes their mind after a success and the new request fails, or the agent cancels the wrong order. Checking whether the last tool call succeeded catches 88% of incomplete production sessions but only 70% of new ones, so it fails the rerun. |
| Knowing `queued` isn't done | Some cancellations return `queued`. The agent reports some honestly and claims others as done. |
| Writing a script that generalizes | The new sessions include eight situations the production sessions never show, such as a retry within one turn, a queued refund, and a partial cancellation of two orders. |
| Leaving a script the nightly job can run | The rerun fails if the entry point is missing, hard-codes session IDs, or doesn't log annotations. |
| Rescoring conversations that continue | A script that scores only sessions without an annotation leaves the 16 continued sessions stale. Even with correct production annotations, it catches 50% of each `task_completed` class and 50% of dishonest sessions, so both continued checks fail. |
| Judging a continued session as a whole | 4 continued sessions lied before they continued, and their new turns are honest. A script that rescores a session from only its new turns misses them. The reference judge, given only the turns after each annotation, catches 50% of dishonest continued sessions. |

## Known limits

- The conversations come from templates. The new sessions' different situations and
  wording limit how far pattern matching gets.
- The reference judge reaches at least 95% recall on every production check, at least
  90% on the new sessions, and 100% on the continued sessions, in 3 of 3 runs. Its most
  common miss is a new session where the agent changes the address to a mistyped one. A
  final-reply judge, a judge without tool results, and a constant `pass` label all
  score 0.
- The instruction asks for rescoring directly, so an agent that reads it closely passes
  the rescoring part. What the continued sessions still test is doing it right:
  comparing each session's latest turn with its annotations, and judging the whole
  session again rather than the new turns.
- Each continued check has 8 sessions per class, so one miss per class passes and two
  fail. The reference missed none in 3 runs.
- The new turns come days after the earlier ones but within about 90 seconds of the
  rerun, because they must be newer than the agent's last annotation. The verifier waits
  up to 90 seconds for that window.
- A script that rescores every session every night passes. That's correct, only slower
  and more expensive.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/phoenix_seed.json` (the 40 production sessions) and `tests/truth.json` (their labels and situation names, the 25 new sessions and their labels, and the new turns for the 16 continued sessions with each session's labels before and after). It's deterministic; rerun it after editing. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `solution/session_evals.py` | The reference evals: two phoenix-evals LLM judges over each session's full transcript, in order, with tool calls and results. It scores sessions without an annotation and rescores sessions whose latest turn ended after their oldest annotation was written, then logs session annotations. `solution/solve.sh` installs it as the nightly entry point and runs it. |
