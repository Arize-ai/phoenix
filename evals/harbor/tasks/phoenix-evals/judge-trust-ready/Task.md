# judge-trust-ready

The user wants to use an LLM safety judge to auto-block unsafe replies, and asks whether
it's good enough. The agent has to find all of the reviewers' labels, compare the
judge's verdicts with them, compute the two numbers the user's bar is about, and make a
call. The judge meets both bars, so the right answer is turn it on.

This task is the twin of [judge-trust](../judge-trust/Task.md). The request and the
verifier are the same. Only the data differs: there the judge misses too many unsafe
replies, so the right answer is don't turn it on. Here recall is close to the bar.
Missing the reviews logged as trace annotations pushes recall under it, and two common
counting mistakes push precision past the limit, so an agent has to count carefully and
still commit to a yes.

## The request

The agent gets `instruction.md` word for word:

> We want to use our `safety_judge` eval to auto-block unsafe replies from our support assistant. Its verdicts are logged as `safety_judge` annotations on the traces in our `support-chat` project in Phoenix, and our reviewers have labeled 80 of the same traces as `human_safety`.
>
> The judge has to catch at least 90% of the replies reviewers mark unsafe, and no more than a quarter of what it blocks can be false alarms. Can we turn it on? Show me the numbers your answer is based on.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-chat` | 120 traces from a support assistant for a store that sells smart-home devices, e-bikes, and small appliances. Each has a root `support-assistant` span with the customer's message and the reply, and one LLM span. Most replies are routine. Some get around account security, share another customer's data, or encourage dangerous product use. |
| `safety_judge` annotations | One per trace, on the LLM span: `unsafe` or `safe`, with an explanation. Four judge runs failed and have no label, only an explanation such as `error: provider timeout after 30s`. |
| `human_safety` annotations | On 80 traces: `unsafe` or `safe`, with a short note on unsafe ones. Reviewers switched tools partway through, so the first 50 reviews are span annotations on the root span and the last 30 are trace annotations. The other 40 traces have no review. |

How the judge's verdicts compare with the reviewers' labels on the 80 reviewed traces:

| | Reviewer: unsafe | Reviewer: safe |
| --- | --- | --- |
| Judge: unsafe | 13 | 3 |
| Judge: safe | 1 | 60 |
| Judge run failed | 0 | 3 |

On the 77 traces with both labels, the judge catches 13 of 14 unsafe replies (92.9%
recall). Of the 16 replies it would block, 13 are unsafe (81.25% precision), so 19% of
blocks are false alarms. Both bars are met.

The 30 trace annotations hold 5 caught unsafe replies, no misses, 1 false alarm, 1
failed run, and 23 agreed safe replies. On the 50 root-span reviews alone, the judge
catches 8 of 9 (88.9%, under the bar) and 8 of its 10 blocks are unsafe (80%, so 20%
false alarms).

## How it's graded

The verifier grades the agent's final reply. An LLM pulls out the decision and each
number below, with a quote from the reply, without seeing the expected values. Code then
checks that the quote is really in the reply and compares the value. An empty reply
scores 0 without a model call. `reward` is 1 only if every check passes.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | Turn it on | The reply says to turn the judge on now. "Yes", "go ahead", and "safe to enable" count. Waiting or retesting first fails. |
| `unsafe_recall` | 92.9% (13 of 14) | The reply's number is within 1.1 points. |
| `unsafe_precision` | 81.25% (13 of 16) | The reply's precision is within 1.1 points, or its false-alarm share of blocks is within 1.1 points of 18.75%. |

The metrics count traces that have both a reviewer label and a judge label, whether the
label is on the root span or on the trace. The three failed runs on reviewed traces are
all on replies reviewers marked safe, so counting them as `safe` verdicts gives the same
numbers. The 1.1-point tolerance allows rounding to a whole percent.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Finding every review | The request says 80 traces were reviewed, but only 50 labels are span annotations. The other 30 are trace annotations. Reading only span annotations gives 88.9% recall, under the bar, and flips the decision. |
| Handling failed judge runs | Counting the 3 failed runs as blocks drops precision to 68%, past the false-alarm limit, and flips the decision. |
| Leaving out unreviewed traces | The judge flags 7 traces with no review. Counting them as false alarms drops precision to 57% and flips the decision. |
| Committing to a call near the bar | Recall (93%) is close to the 90% bar. A reply that gives the numbers but leaves the call open fails `decision`. |
| Backing the call with the right numbers | A reply that cites only 95% agreement gets the decision right but states neither metric, so it fails. |
| Matching annotations across spans | The judge annotates the LLM span and reviewers annotate the root span or the trace, so matching by span finds no pairs. |
| Not answering from habit | The twin task has the same request with the opposite answer. |

Controls we ran locally against the seeded data:

| Control | Reward | Failing checks |
| --- | --- | --- |
| No reply (nop) | 0 | All |
| Reference solution (3 runs) | 1 | None |
| Span annotations only (the earlier reference solution) | 0 | `decision`, `unsafe_recall`, `unsafe_precision` |
| Failed runs counted as blocks | 0 | `decision`, `unsafe_precision` |
| Unreviewed traces counted as safe | 0 | `decision`, `unsafe_precision` |

Three of the 4 pilot agents read only span annotations. Two used the Python client's
`get_span_annotations_dataframe`, and one used `px span list --include-annotations`.
Rerun on this data, their code finds 50 reviews and the root-span numbers above. Those
numbers fail all three checks, as the span-only control shows. The fourth counted the trace-level annotations in
`px trace list --include-annotations` before it read spans, so it would likely have
found all 80.

## Known limits

- Recall rests on 14 unsafe replies, so one trace moves it by 7 points. One more miss
  would put recall at 86% and flip the answer, and the data has exactly one miss.
- Reading only span annotations misses precision by 1.25 points (80% against 81.25%),
  only past the 1.1-point tolerance. The `decision` and `unsafe_recall` checks fail by
  wider margins.
- The Python client can't read trace annotations. An agent has to call the REST API
  (`GET /v1/projects/support-chat/trace_annotations`), filter spans with
  `trace_annotations['human_safety']`, or use `px trace list --include-annotations`.
- The replies come from templates. An agent could label traces itself, but its own labels
  wouldn't reproduce the reviewers' numbers, which is what the request asks for.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Runs the shared generator in `../judge-trust/fixture/build.py`, which writes `fixture/spec.json` and `tests/truth.json` for both tasks. |
| `tests/test.py` | The verifier, the same as `judge-trust`'s. `tests/truth.json` holds the expected values, the confusion counts, what reading only span annotations gives, and each trace's labels. |
| `solution/solve.py` | The reference solution, the same as `judge-trust`'s. It reads `safety_judge` and both kinds of `human_safety` annotation from Phoenix, matches them by trace, computes recall and precision, and writes the reply. |
