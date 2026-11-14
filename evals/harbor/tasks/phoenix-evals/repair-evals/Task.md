# repair-evals

The user's nightly grounding eval says 95% of their support bot's replies are grounded,
but reviewers keep finding made-up claims. The shipped script has five bugs that inflate
the rate, and a rule that labels every errored trace `fail` without judging it. The
agent has to find them, fix the script in place, rerun it so every trace's `grounded`
annotation is right, and reply with what was wrong and the real rate. The verifier
checks the annotations and the reply, then runs the fixed script on new traces.

## The request

The agent gets `instruction.md` word for word:

> Our nightly grounding eval (`/app/evals/nightly_grounding.py`) says about 95% of our support bot's replies are grounded, but our reviewers keep finding replies that make things up. The bot's traces are in Phoenix under the `support-bot` project.
>
> Can you figure out why the eval's numbers are misleading, fix it, and rerun it so the `grounded` annotations (`pass` or `fail`) on the `support-bot` traces are right? Keep the script path, the annotation name, and the `gpt-5-nano` judge: our nightly job runs `python evals/nightly_grounding.py` from `/app` with an API key that can only call `gpt-5-nano`.
>
> Then tell me what was wrong and what the real grounded rate is.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-bot` | 60 traces, one per customer message about order status, tracking, delivery dates, or address changes. The root `handle_message` span has the message and the reply. A message arrives either as chat, with a `message` field, or as email, with `subject` and `body`. The children are a `lookup_order` tool call (the order record), a `track_shipment` tool call (carrier tracking) when the order has shipped, a `search_help_center` retriever with 3 help articles, and the LLM call. No annotations. |
| `/app/evals/nightly_grounding.py` | The team's nightly script. It runs without errors and prints `Scored 20 replies: 19 grounded (95%).` |
| `/app/support_bot.py` | The bot's prompt, tools, and message handling, for context. It shows that when `track_shipment` times out, the bot still answers from the order record and articles, and marks the trace as an error. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run the judge. |

No labels are visible. 22 of the 60 replies (37%) make one claim that nothing the bot
looked up supports: an action it never took, a policy no article states, or a date,
scan, or order detail that contradicts the order record or tracking data. In 9 of them,
one fact inside an otherwise normal reply is wrong, such as the delivery estimate or the
order date. 12 add or replace a sentence. Grounded replies add sentences too, including
"I've ..." statements about what the bot looked up, so wording and length don't give the
label away. 19 of the 60 messages are email. Email and made-up claims are assigned
independently.

In two traces, `track_shipment` times out, so the root span's status is `ERROR`. One
reply says tracking couldn't load and restates the order record. The other reads like a
normal reply but gives a carrier delivery estimate the bot never got. Both are graded
like any other reply.

The real grounded rate is 38 of 60 (63%), or 37 of 58 (64%) leaving out the two
timeouts.

## How it's graded

`reward` is 1 only if all eight checks pass.

The two annotation checks read the latest `grounded` annotation on each trace. Each one
passes when those annotations cover at least 95% of the traces and catch at least 80% of
grounded replies and at least 80% of ungrounded ones. Checking each class separately
means a constant label fails. Labels count by meaning, so `grounded` works as well as
`pass`.

The six reply checks grade the agent's final message. An LLM (`gpt-6-luna`) reads it
without seeing the expected values. For each of the five bugs, it says whether the reply
gives the cause with its mechanism (`named`), gives only a symptom or blames the script
or prompt in general terms (`vague`), or doesn't mention it. It also extracts the
grounded rate the reply reports. Each answer comes with a quote, and code checks that the
quote is in the reply. An empty reply fails every reply check without a model call.

| Check | What passes |
| --- | --- |
| `production_grounded` | On the 60 production traces, at least 80% recall on each class. |
| `reply_span_limit` | The reply says the span query returned only a limited number of spans, such as the client's default of 100 or one page, so only some replies were scored. "Only recent replies were scored" alone is `vague`. |
| `reply_verdict_case` | The reply says the code compared the judge's uppercase `FAIL` with lowercase `"fail"`, so no reply could fail. "Failures never reached Phoenix" alone is `vague`. |
| `reply_errors_pass` | The reply says an error or exception while scoring was recorded as `pass`, such as the `KeyError` on email messages. |
| `reply_judge_evidence` | The reply says the judge saw only the message and the reply, not what the bot looked up (its context: the order record, tracking data, or articles). Saying only that the prompt was weak or asked whether the reply "sounds reasonable" is `vague`. |
| `reply_wrong_traces` | The reply says verdicts were attached to traces or spans other than the ones they judged. |
| `reply_grounded_rate` | The reply's rate matches the agent's own production annotations within 1.1 points: the share labeled grounded over all 60 traces, or over the 58 without a timeout. It must also fall in the range that annotations passing `production_grounded` can give: 52% to 70% over 60, or 52% to 71% over 58. |
| `new_traces_grounded` | The verifier adds 36 new traces and runs `python evals/nightly_grounding.py` as the agent user, with a key that can only call `gpt-5-nano`. On the new traces, at least 80% recall on each class. |

The rate tolerance follows from the recall bar. Annotations that pass
`production_grounded` call at least 31 of the 38 grounded replies grounded (80%) and at
most 4 of the 22 ungrounded ones (20%), so they report between 31 and 42 of 60 as
grounded. A tighter band around the true 63% would fail agents whose annotations pass:
an earlier version of the reference judge called 84% to 89% of grounded replies grounded
and reported 53% to 57%. The 1.1-point match is less than one trace (1.7 points), so the
reply has to report what its own annotations say, rounded to a whole percent at most.

### Controls

| Run | Reward | What fails |
| --- | --- | --- |
| Nop (the shipped script, no reply) | 0 | Every check. The rerun scores 21 new replies. |
| Reference, 3 local runs | 1, 1, 1 | Nothing. Production recall 97% on grounded and 100% on ungrounded; new traces 95% to 100% and 100%. The reply reports 62%, matching its annotations. |
| Reference with errored traces marked `fail` | 0 | `new_traces_grounded`: 68% to 77% recall on grounded new replies in two runs. Production passes at 87% to 92%. |
| Reference that skips errored traces | 0 | `new_traces_grounded`: 78% coverage of new traces. |
| Reference with the shipped judge prompt and no lookups | 0 | `production_grounded` (23% of ungrounded replies caught), `new_traces_grounded` (none caught), and `reply_grounded_rate` (82%, outside the range). |
| Reference reply without the wrong-traces cause | 0 | `reply_wrong_traces` only. |
| Reference reply that reports the true 63% instead of its own rate | 0 | `reply_grounded_rate` only: its annotations say 57%. |

We ran the extractor 5 to 8 times on each of 17 replies. The four pilot agents'
replies, five paraphrased correct replies, and the reference reply passed all five bug
checks in every run. Seven flawed replies (a missing cause, the judge blamed only for
its question, a wrong mechanism, symptoms only, no rate) failed the check they were
written to fail in every run.

The four pilot agents all named the five bugs, and each reported the rate its own
annotations gave, so the reply checks alone wouldn't fail any of them. Replayed on this
fixture, the two Haiku agents' saved scripts keep the errored-trace rule and fail
`new_traces_grounded` at 73% recall on grounded new replies. The two Fable agents'
scripts judge errored traces on their claims. They had switched the judge to
`gpt-5-mini`; replayed with `JUDGE_MODEL=gpt-5-nano`, both pass the annotation checks
(95% to 100% recall on each class).

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
  articles, and the tracking data, or the tracking error, when the order has shipped.

## What the task tests

Debugging an eval that runs without errors and reports a good number, then explaining
the fix. Each row below fails at least one check when it's the only problem left in an
otherwise fixed script. The reply has to name each of the five bugs.

| Problem | Why it matters | Result when it's the only problem left |
| --- | --- | --- |
| `get_spans` has no `limit`, so it returns the client's default of 100 spans, newest first. | The 60 traces have 283 spans, so only the 20 newest traces get scored. The new traces push every older trace out of that window. | Covers 33% of production traces and 58% of new ones. |
| The prompt asks for `PASS` or `FAIL`, but the code compares the verdict with `"fail"`. | Every reply is labeled `pass`. The stored explanations still start with `FAIL:`, which is the clue. | Catches no ungrounded replies. |
| Any exception is recorded as `pass`. | Email messages have no `message` field, so each one raises `KeyError` before the judge runs. | Catches at most 68% of ungrounded production replies and 57% of new ones. |
| The judge sees only the root span and is asked whether the reply "sounds reasonable and helpful". | Grounded replies cite dates, scans, and tracking numbers that only the child spans contain. Made-up claims sound plausible, and a wrong date reads exactly like a right one. | In one `gpt-5-nano` run, catches 23% of ungrounded production replies and none of the new ones. An earlier measurement found that a grounding question without the tool results calls no grounded reply grounded. |
| Verdicts are computed oldest first but matched to traces newest first. | Every trace gets the verdict of another trace. | With a perfect judge, 63% recall on grounded and 36% on ungrounded production replies. |
| Every trace with an `ERROR` status is marked `fail` without being judged. | A tracking timeout doesn't make a reply ungrounded. Some timeout replies are honest and some state an estimate or scan the bot never got, so the status can't stand in for the label. The new traces end with a carrier outage: 8 timeouts in a row, 5 of them honest. | In production it costs one trace, so `production_grounded` passes. On new traces, at most 77% recall on grounded replies (17 of 22). Marking errored traces `pass` instead catches at most 79% of ungrounded new replies, and skipping them covers 78% of new traces. |

It also tests these behaviors:

| Behavior | How the task checks it |
| --- | --- |
| Rescoring every trace | If the agent runs the shipped script first, 20 traces get its verdicts, almost all `pass`. Rescoring only traces without an annotation leaves them wrong. |
| Judging errored replies on their claims | Production has one honest and one made-up timeout reply. New traffic has 8 timeouts, and its made-up ones use claims production never shows: a scan location, "out for delivery today", and a carrier estimate next to an admission that tracking didn't load. |
| Fixing the judge so it generalizes | New traces have mistakes the production traces never show: a wrong scan location, item, tracking event, or delivery time inside a normal reply, and added claims such as text alerts, free reshipping, a pickup hold, and a discount code. |
| Reporting what the fixed eval found | The reply has to name each bug's mechanism and report the rate its own annotations give. |
| Keeping the nightly job working | The verifier runs `python evals/nightly_grounding.py` from `/app` with a key that refuses every model except `gpt-5-nano`. |

## Known limits

- The reply checks depend on `gpt-6-luna` telling a mechanism from a symptom. Wording
  between the two can go either way: "email replies were marked grounded because the
  script couldn't read them" came back `named` in 2 of 8 runs and `vague` in 6.
- `reply_grounded_rate` compares the reply with the agent's annotations, not with the
  truth. An agent that hand-labels the traces and reports its hand count fails if its
  annotations disagree, even when the hand count is closer to 63%.
- In production the errored-trace rule mislabels one trace, so only the new traces'
  outage makes it fail a check. An agent that keeps the rule and reads the result as a
  team decision loses the reward on new traffic.
- The reference judge on `gpt-5-nano` still flags a grounded reply now and then, such
  as one that calls an "Arrived at facility" event a scan. Its prompt says that advice
  and facts restated in other words aren't unsupported claims. Without that sentence,
  it called 84% to 89% of grounded production replies grounded, close to the 80% bar.
  Replies about stalled tracking also need the judge to accept a business-day count
  from the tracking data.
- The shipped judge sometimes calls a delivery estimate "already passed", comparing the
  fixture's dates with its own idea of today. The grounding judge didn't do this in local
  runs, but a prompt that invites date reasoning could flag grounded replies.
- The replies come from templates, but wording alone can't separate the labels. Before
  the timeout replies were added, matching every sentence against the clean templates
  caught 57% of ungrounded production replies and 64% of new ones. Made-up actions such
  as "I've already sent a replacement" still use verbs no grounded reply uses, because
  the bot has no action tools, but flagging them catches under 25%.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 60 production traces) and `tests/truth.json` (their labels, the timeout traces, and the 36 new traces and their labels). It's deterministic; rerun it after editing. It also prints how many replies the shipped script scores. |
| `workdir/` | Copied to `/app`: the shipped `evals/nightly_grounding.py` and `support_bot.py`. |
| `tests/test.py` | The verifier. |
| `solution/nightly_grounding.py` | The fixed script. It reads every span, gives the judge the tool results (including a failed tracking call) and articles, reads the verdict in any casing, judges errored traces like any other, leaves unscored replies without an annotation, and matches each verdict to its own trace. |
| `solution/report.py` | Writes the reply: the five bugs, the errored-trace rule, and the rate read back from the new `grounded` annotations. `solution/solve.sh` installs the fixed script, runs it, and then runs this. |
