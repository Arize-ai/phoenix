# repair-evals

The agent fixes a nightly grounding eval that reports 95% of a support bot's replies as
grounded when the real rate is 63%. The shipped script has five bugs that make the
rate misleading, plus a rule that labels every errored trace `fail` without judging it. The task
tests whether the agent can debug an eval that runs cleanly, rerun it so every trace's
`grounded` annotation is right, keep it working on new traffic, and explain what was
wrong.

## The request

> Our nightly grounding eval (`/app/evals/nightly_grounding.py`) says about 95% of our support bot's replies are grounded, but our reviewers keep finding replies that make things up. The bot's traces are in Phoenix under the `support-bot` project.
>
> Can you figure out why the eval's numbers are misleading, fix it, and rerun it so the `grounded` annotations on those traces are right? Keep the judge on `gpt-5-nano`, and keep it runnable as `python evals/nightly_grounding.py` from `/app`, since that's how our nightly job runs it.
>
> Then tell me what was wrong and what the real grounded rate is.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-bot` | 60 traces, one per customer message about order status, tracking, delivery dates, or address changes. The root `handle_message` span holds the message and the reply. A message arrives as chat, with a `message` field, or as email, with `subject` and `body`. The children are a `lookup_order` tool call (the order record), a `track_shipment` tool call (carrier tracking) once the order has shipped, a `search_help_center` retriever with 3 help articles, and the LLM call. No annotations. |
| `/app/evals/nightly_grounding.py` | The team's nightly script. It runs without errors and prints `Scored 20 replies: 19 grounded (95%).` Its docstring says it logs `grounded` as `pass` or `fail` on each reply's root span. |
| `/app/support_bot.py` | The bot's prompt, tools, and message handling. It shows that when `track_shipment` times out, the bot still answers from the order record and articles, and marks the trace as an error. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run the judge. |

## How the data was made

`fixture/build.py` writes the 60 production traces and, for grading, 36 new traces. The
following parts are hand-written in the script:

- The 9 help articles, the customer-message templates, and the email subjects.
- A reply template for each of 7 scenarios, such as a stalled package or an address
  change after shipping.
- The made-up claims. The new traces use kinds of claims that production never shows,
  such as a wrong scan location, item, or delivery time, a text alert, free reshipping,
  a pickup hold, and a discount code.
- Supported extra sentences that grounded replies add, including "I've ..." statements
  about what the bot looked up, so an added sentence doesn't predict the label.
- Which traces time out, their replies, and which of those replies make a claim.

The random seed (41 for production, 59 for the new traces) picks which non-timeout traces
get a made-up claim and which messages arrive by email, in fixed counts for each label.
It shuffles scenarios within each label so that every scenario appears under both
labels. For each trace, it picks the carrier, tracking number, hub, tracking event,
delivery note, dates, new address, shipping method of an unshipped order, question
template, email subject, reply template variant, and the wrong value that a changed fact
gets. It also decides whether a reply gets a supported extra sentence (60% of grounded
replies and 40% of ungrounded ones that don't already add a claim) and where an added
sentence goes. Customer names, items, order IDs, and timestamps follow the trace's
position, not the seed.

A reply is ungrounded exactly when the generator gave it one made-up claim:

- One fact in an otherwise grounded reply changed to a wrong value. A changed date never
  matches any other date the bot looked up.
- A sentence added or replaced with a claim from the hand-written list, such as an
  action the bot never took or a policy no article states.
- After a tracking timeout, a scan, delivery estimate, or delivery day the bot never
  received.

Every other sentence restates the order record, the tracking data, or an article, or
makes no claim. The expected grounded rate is the share of grounded replies.

| | Production | New traces |
| --- | --- | --- |
| Traces | 60 | 36 |
| Grounded | 38 | 22 |
| Ungrounded: one fact changed | 9 | 4 |
| Ungrounded: sentence added | 9 | 7 |
| Ungrounded: sentence replaced | 3 | 0 |
| Ungrounded: claim after a timeout | 1 | 3 |
| Tracking timeouts, honest ones in parentheses | 2 (1) | 8 (5) |
| Email messages | 19 | 13 |

The new traces end with a carrier outage: 8 timeouts in a row. Their made-up replies
claim a scan location, delivery today, or a carrier estimate next to an admission that
tracking didn't load. A changed fact uses the same template as a grounded reply, so
wording alone can't separate 9 of the 22 ungrounded production replies, or 4 of the 14
new ones, from grounded replies.

`build.py` raises an error if a changed fact keeps its true value or the reply doesn't
state it. It asserts that the shipped script's 100-span window gives 95% on the
production traces, the rate the request quotes, that the window misses traces in both
sets, and that `expected.json` stays under 2 KB. GPT-6 Astra checked the labels against the rule above.

## How it's graded

The annotation checks read the latest `grounded` annotation on each trace, on any of its
spans or on the trace itself. Labels count by meaning: `pass`, `grounded`, `yes`, and
other clear good labels count as grounded, and their opposites count as ungrounded. A
numeric score counts when the label is unclear. Each check requires recall on both
classes, so a constant label fails.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `production_traces` | Code | `grading_data.json` | The annotations cover at least 95% of the 60 production traces, and call at least 80% of grounded replies grounded and at least 80% of ungrounded replies ungrounded. |
| `new_traces` | Code | `grading_data.json` | The verifier adds the 36 new traces in the last 6 hours and runs `python evals/nightly_grounding.py` from `/app` as the agent user, with a 15-minute limit. A local proxy refuses every chat model except `gpt-5-nano` with a 403. The new traces' annotations then meet the same coverage and recall bars. |
| `reply` | LLM extraction, then code | `expected.json`, `grading_data.json` | The final reply names each of the five bugs with its mechanism. It also reports a grounded rate within 1.1 points of the share that the agent's production annotations give, over all 60 traces or over the 58 without a timeout, and inside the range that annotations passing `production_traces` can give: 31 to 42 of 60 (52% to 70%), or 30 to 41 of 58 (52% to 71%). |

For `reply`, an LLM (`gpt-6-luna`) reads the reply without seeing the expected values.
For each bug, it says whether the reply gives the cause with its mechanism (`named`),
gives only a symptom or blames the script in general terms (`vague`), or doesn't mention
it. It also extracts the reported rate. Each answer comes with a quote, and code checks
that the quote is in the reply. An empty reply fails without a model call. `details.json`
lists the result for each bug and for the rate under `reply`.

| Bug | Counts as `named` when the reply says |
| --- | --- |
| `span_limit` | The span query returned a limited number of spans, such as the client's default of 100 or one page, so only some replies were scored. "Only recent replies were scored" alone is `vague`. |
| `verdict_case` | The code compared the judge's uppercase `FAIL` with lowercase `"fail"`, so no judged reply could fail. |
| `errors_pass` | An error while scoring was recorded as `pass`, such as the `KeyError` on email messages. |
| `judge_evidence` | The judge saw only the message and the reply, not what the bot looked up. "The prompt was weak" alone is `vague`. |
| `wrong_traces` | Verdicts went to traces or spans other than the ones they judged. |

The rate range follows from the recall bar, so any annotations that pass
`production_traces` can report a passing rate. The 1.1-point match is less than one
trace (1.7 points), so the reply has to report what its own annotations say, rounded to
a whole percent at most.

`reward` is 1 only when every check passes. These measures are reported beside `reward`
and don't affect it:

- `turn_count`, `tool_count`, and `loaded_<skill>`: how the agent worked.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
  The shipped script calls the OpenAI client directly, so a fix in place often scores 0.
- `prompt_quality`: the share of the rerun's judge requests whose prompt meets the suite
  rubric. For this task, the rubric expects the customer's message, the reply, the order
  record, the help articles, and the tracking data or tracking error.

## What the task tests

Each row fails its check when it's the only problem left in an otherwise fixed script or
reply.

| Wrong approach | Check it fails |
| --- | --- |
| Leaving `get_spans` at the client's default limit of 100 spans | `production_traces` and `new_traces`: the script covers 33% of production traces and 58% of new ones. |
| Leaving the verdict comparison case-sensitive | `production_traces` and `new_traces`: no reply is labeled ungrounded. |
| Leaving errors recorded as `pass`, so every email message counts as grounded | `production_traces` and `new_traces`: at most 68% of ungrounded production replies and 57% of new ones are caught. |
| Leaving the judge with only the message and the reply | `production_traces` and `new_traces`: in one `gpt-5-nano` run, the judge caught 23% of ungrounded production replies and none of the new ones. |
| Leaving verdicts matched to the wrong traces | `production_traces` and `new_traces`: even a perfect judge gets 63% recall on grounded and 36% on ungrounded production replies, and 64% and 36% on new ones. |
| Keeping the rule that marks errored traces `fail` | `new_traces`: at most 17 of 22 grounded new replies (77%) are labeled grounded. Production loses only one trace and passes. |
| Skipping errored traces, or marking them `pass` | `new_traces`: skipping covers 78% of new traces, and `pass` catches at most 11 of 14 ungrounded new replies (79%). |
| Running the shipped script first, then rescoring only traces without an annotation | `production_traces`: the 20 newest traces keep the shipped script's verdicts, almost all `pass`. |
| Switching the judge to a larger model | `new_traces`: the rerun's model calls get a 403. |
| Reporting a hand count or the true 63% instead of the rate the fixed eval's annotations give | `reply` |
| Describing symptoms, such as "only recent replies were scored", instead of each bug's mechanism | `reply` |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Scripted wrong
approaches, such as the reference with errored traces marked `fail` or skipped, with the
shipped judge prompt, or with a reply that reports the true 63% instead of its own rate,
score 0.

## Known limits

- `reply` depends on `gpt-6-luna` telling a mechanism from a symptom, and wording between
  the two can go either way. "Email replies were marked grounded because the script
  couldn't read them" came back `named` in 2 of 8 runs.
- `reply` compares the reported rate with the agent's own annotations, not with the
  truth. An agent that hand-labels the traces and reports its hand count fails if its
  annotations disagree, even when the hand count is closer to 63%.
- The request doesn't say how to treat errored traces. The errored-trace rule mislabels
  one production trace, so only the new traces' outage catches it. An agent that keeps
  the rule as a team decision loses the reward on new traffic.
- `gpt-5-nano` sits close to the bar on grounded replies. The reference prompt says that
  advice and facts restated in other words aren't unsupported claims. Without that
  sentence, the reference judge called 84% to 89% of grounded production replies
  grounded. A prompt that
  invites date reasoning can also flag grounded replies, because the fixture's dates are
  in the past.
- Labels count through the shared word list in `grading.to_bool`, which covers the
  usual grounding labels. A label outside it counts only through the annotation's score,
  read as 1 for grounded.
