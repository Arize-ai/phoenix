# repair-evals

The user's nightly grounding eval says 95% of their support bot's replies are grounded,
but reviewers keep finding made-up claims. The shipped script has five bugs. The agent
has to find them, fix the script in place, rerun it so every trace's `grounded`
annotation is right, and report the real rate. The verifier checks the annotations, then
runs the fixed script on new traces.

## The request

The agent gets `instruction.md` word for word:

> Our nightly grounding eval (`/app/evals/nightly_grounding.py`) says about 95% of our support bot's replies are grounded, but our reviewers keep finding replies that make things up. The bot's traces are in Phoenix under the `support-bot` project.
>
> Can you figure out why the eval's numbers are misleading, fix it, and rerun it so the `grounded` annotations (`pass` or `fail`) on the `support-bot` traces are right? Keep the script path and the annotation name; our nightly job runs `python evals/nightly_grounding.py` from `/app`.
>
> Then tell me what was wrong and what the real grounded rate is.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-bot` | 60 traces, one per customer message about order status, tracking, delivery dates, or address changes. The root `handle_message` span has the message and the reply. A message arrives either as chat, with a `message` field, or as email, with `subject` and `body`. The children are a `lookup_order` tool call (the order record), a `track_shipment` tool call (carrier tracking) when the order has shipped, a `search_help_center` retriever with 3 help articles, and the LLM call. No annotations. |
| `/app/evals/nightly_grounding.py` | The team's nightly script. It runs without errors and prints `Scored 21 replies: 20 grounded (95%).` |
| `/app/support_bot.py` | The bot's prompt, tools, and message handling, for context. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run the judge. |

No labels are visible. 21 of the 58 graded replies (36%) make one claim that nothing the
bot looked up supports: an action it never took, a policy no article states, or a date,
scan, or order detail that contradicts the order record or tracking data. In 9 of them,
one fact inside an otherwise normal reply is wrong, such as the delivery estimate or the
order date. The other 12 add or replace a sentence. Grounded replies add sentences too,
including "I've ..." statements about what the bot looked up, so wording and length don't
give the label away. 19 of the 58 messages are email.
Email and made-up claims are assigned independently. In two more traces,
`track_shipment` times out and the bot sends a canned apology. Those two aren't graded.

The real grounded rate is 37 of 58 graded replies (64%), or 39 of 60 (65%) counting the
two apologies as grounded. The reply isn't graded.

## How it's graded

`reward` is 1 only if both checks pass. Each check reads the latest `grounded`
annotation on each trace. It passes when those annotations cover at least 95% of the
traces, and they catch at least 80% of grounded replies and at least 80% of ungrounded
ones. Checking each class separately means a constant label fails. Labels count by
meaning, so `grounded` works as well as `pass`.

| Check | Which traces | What passes |
| --- | --- | --- |
| `production_grounded` | The 58 graded traces in the project. | At least 80% recall on each class. |
| `new_traces_grounded` | 28 new traces the verifier adds. It then runs `python evals/nightly_grounding.py` as the agent user. | At least 80% recall on each class. |

On `gpt-5-nano`, the reference solution catches 84% of grounded production replies and
all of the rest, so it passes with a thin margin. The best
partial fix we measured, with every bug fixed except what the judge sees and asks,
catches 43% to 48% of ungrounded replies.

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
  The shipped script calls the OpenAI client directly, and fixing it in place is fine,
  so this score is often 0 here.
- `prompt_quality`: the share of judge requests whose prompt meets the rubric. For this
  task, the rubric grader knows that a `grounded` judge needs the customer's message
  (chat text, or email subject and body), the reply, the order record, the help
  articles, and the tracking data when the order has shipped.

## What the task tests

Debugging an eval that runs without errors and reports a good number. Each of the five
bugs alone fails a check. The last column shows the result when only that bug is left
in an otherwise fixed script.

| Bug | Why it matters | Result when it's the only bug left |
| --- | --- | --- |
| `get_spans` has no `limit`, so it returns the client's default of 100 spans, newest first. | The 60 traces have 279 spans, so only the 21 newest traces get scored. The new traces push every older trace out of that window. | Covers 34% of production traces and 75% of new ones. |
| The prompt asks for `PASS` or `FAIL`, but the code compares the verdict with `"fail"`. | Every reply is labeled `pass`. The stored explanations still start with `FAIL:`, which is the clue. | Catches no ungrounded replies. |
| Any exception is recorded as `pass`. | Email messages have no `message` field, so each one raises `KeyError` before the judge runs. | Catches 67% of ungrounded production replies. |
| The judge sees only the root span and is asked whether the reply "sounds reasonable and helpful". | Grounded replies cite dates, scans, and tracking numbers that only the child spans contain. Made-up claims sound plausible, and a wrong date reads exactly like a right one. | Catches 43% to 48% of ungrounded replies. With a grounding question but no tool results, it calls no grounded reply grounded. |
| Verdicts are computed oldest first but matched to traces newest first. | Every trace gets the verdict of another trace. | 65% recall on grounded and 38% on ungrounded production replies. |

It also tests these behaviors:

| Behavior | How the task checks it |
| --- | --- |
| Rescoring every trace | If the agent runs the shipped script first, 21 traces get wrong verdicts. Rescoring only traces without an annotation leaves them wrong. |
| Fixing the judge so it generalizes | New traces have mistakes the production traces never show: a wrong scan location, item, tracking event, or delivery time inside a normal reply, and added claims such as text alerts, free reshipping, a pickup hold, and a discount code. |
| Keeping the nightly job working | The verifier runs `python evals/nightly_grounding.py` from `/app`. |

## Known limits

- The results in the bug table were measured with `gpt-5.6-luna`, a stronger model than
  the shipped script's `gpt-5-nano`. With the shipped question, a weaker judge catches
  fewer made-up claims, so that row's numbers are a best case.
- The shipped judge sometimes calls a delivery estimate "already passed", comparing the
  fixture's dates with its own idea of today. The grounding judge didn't do this in local
  runs, but a prompt that invites date reasoning could flag grounded replies.
- Replies about stalled tracking need the judge to accept a business-day count from the
  tracking data. One local reference run missed one of these.
- The replies come from templates, but wording alone can't separate the labels.
  Matching every sentence against the clean templates catches 57% of ungrounded
  production replies and 64% of new ones. Made-up actions such as "I've already sent a
  replacement" still use verbs no grounded reply uses, because the bot has no action
  tools, but flagging them catches under 25%.
- The shipped script marks errored traces `fail`. Those traces aren't graded, so keeping
  or dropping that rule doesn't change the reward.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 60 production traces) and `tests/truth.json` (their labels, plus the 28 new traces and their labels). It's deterministic; rerun it after editing. It also prints how many replies the shipped script scores. |
| `workdir/` | Copied to `/app`: the shipped `evals/nightly_grounding.py` and `support_bot.py`. |
| `tests/test.py` | The verifier. |
| `solution/nightly_grounding.py` | The fixed script. It reads every span, gives the judge the tool results and articles, reads the verdict in any casing, leaves unscored replies without an annotation, and matches each verdict to its own trace. `solution/solve.sh` installs it over the shipped script and runs it. |
