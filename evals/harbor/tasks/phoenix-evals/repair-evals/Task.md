# repair-evals

Find out why an existing eval reports misleadingly good numbers, fix it, and rerun it.
Workflow: **fix a misleading eval**.

## The request

The agent receives `instruction.md` verbatim:

> Our nightly grounding eval (`/app/evals/nightly_grounding.py`) says about 95% of our support bot's replies are grounded, but our reviewers keep finding replies that make things up. The bot's traces are in Phoenix under the `support-bot` project.
>
> Can you figure out why the eval's numbers are misleading, fix it, and rerun it so the `grounded` annotations (`pass` or `fail`) on the `support-bot` traces are right? Keep the script path and the annotation name; our nightly job runs `python evals/nightly_grounding.py` from `/app`.
>
> Then tell me what was wrong and what the real grounded rate is.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `support-bot` | 60 traces, one per customer message about order status, tracking, delivery dates, or address changes. Root `handle_message` agent span (input: a chat payload with `message`, or an email payload with `subject` and `body`; output: the reply). Children: `lookup_order` tool (order record), `track_shipment` tool (carrier tracking) when the order has shipped, `search_help_center` retriever (3 help center articles), and the LLM call. No annotations. |
| `/app/evals/nightly_grounding.py` | The team's nightly script. It runs as shipped and prints `Scored 21 replies: 20 grounded (95%).` |
| `/app/support_bot.py` | The bot's prompt, tools, and payload handling, for context. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. |

No labels are visible. 21 of the 58 graded replies (36%) make exactly one claim that
nothing the bot looked up supports: an action it never took, a policy no article
states, or a date, scan, or status that contradicts the tracking data. 19 of the 58
messages arrive by email. Email and defects are assigned independently. In two more
traces, `track_shipment` times out and the bot sends a canned apology; those two aren't
graded.

The real grounded rate is 37 of 58 graded replies (64%), or 39 of 60 (65%) if you count
the two apologies as grounded. The reply isn't graded.

## How it's graded

`reward` is 1 only when both checks pass. A check passes when the latest `grounded`
annotation covers at least 95% of the traces, and its labels catch at least 80% of
grounded replies **and** of ungrounded replies. A constant label catches 0% of one
class, so it fails.

| Check | Traces | Bar |
| --- | --- | --- |
| `production.grounded` | The 58 graded traces in the fixture | Coverage 0.95; recall 0.8 on each class |
| `new_traces.grounded` | 28 new traces the verifier adds, then runs `python evals/nightly_grounding.py` as the agent user | Same |

The verifier reads annotations on any span of a trace, or on the trace itself, and uses
the latest one, so a rerun overrides earlier verdicts. Labels map to pass or fail by
meaning (`pass`, `grounded`, `1`, ... versus `fail`, `ungrounded`, `0`, ...), never by
agreement with the hidden labels.

The 0.8 recall bar matches `grounded` in `response-evals`. The reference solution
reaches 1.0 on both classes in local runs (once 0.94 on grounded new traces). The best
partial fix measured, every bug fixed except the judge's inputs and question, reaches
0.62 on ungrounded replies.

## What the task targets

The shipped script has five planted bugs. Each one alone fails a check: the last
column shows the result when only that bug is left in an otherwise fixed script.

| Bug | Which cases expose it | Result when it's the only bug left |
| --- | --- | --- |
| `get_spans` without `limit` returns the client's default of 100 spans, newest first | The 60 traces have 279 spans, so only the 21 newest traces get scored. The 28 new traces push every older trace out of that window. | Coverage 0.34 on production and 0.75 on new traces |
| The prompt asks for `PASS` or `FAIL`, but the code compares the verdict with `"fail"` | Every verdict, so every reply is labeled `pass`. The stored explanations still start with `FAIL:`. | Ungrounded recall 0.00 |
| Any exception is recorded as `pass` | Email payloads have no `message` key, so each email raises `KeyError` before the judge runs. | Ungrounded recall 0.67 on production and 0.64 on new traces |
| The judge sees only the root span and is asked whether the reply "sounds reasonable and helpful" | Every grounded reply cites dates, scans, and tracking numbers that only child spans contain. Fabricated claims sound plausible. | Ungrounded recall 0.62 with the shipped question. With a grounding question but no tool results, grounded recall is 0.05. |
| Verdicts are computed oldest first but zipped onto roots in API order, newest first | Every trace gets the verdict of its mirror trace. | Grounded recall 0.65 and ungrounded recall 0.38 on production |

Other traps:

| Trap | Which cases expose it |
| --- | --- |
| Rescoring only unannotated traces | If the agent runs the shipped script first, 21 traces carry misaligned verdicts. An incremental rerun leaves them wrong. |
| Overfitting to visible claims | New traces use claim types the visible ones never show: insurance, text alerts, a same-day cutoff, a wrong scan location, and a neighbor's signature. |
| Moving the entry point | The verifier runs `python evals/nightly_grounding.py` from `/app`. |

## Known limits

- The judge-input numbers come from one judge model (`gpt-5.6-luna`). A stronger judge on
  the shipped question might catch more fabricated claims, because some contradict the
  same reply.
- The shipped judge sometimes calls a delivery estimate "already passed", so the model
  compares fixture dates with its own idea of today. The grounding judge wasn't
  affected in local runs, but a judge prompt that invites date reasoning could flag
  grounded replies.
- Stalled-tracking replies need the judge to accept a business-day count from the
  tracking data. One local reference run missed one of these.
- Replies are templated, so a determined agent could pattern-match visible wordings; the
  new traces limit how far that gets.
- The shipped script marks errored traces `fail`. Those traces aren't graded, so keeping
  or dropping that rule doesn't change the reward.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 60 visible traces) and `tests/truth.json` (their labels, plus the 28 new traces and labels). Rerun it after editing; it's deterministic. It also prints how many replies the shipped script scores. |
| `workdir/` | Copied to `/app`: the shipped `evals/nightly_grounding.py` and `support_bot.py`. |
| `tests/test.py` | The verifier. |
| `solution/nightly_grounding.py` | The corrected script: it reads every span, gives the judge the tool results and articles, parses the verdict in any casing, leaves unscored replies unannotated, and keys each verdict by its own root span. `solution/solve.sh` installs it over the shipped script and runs it. |
