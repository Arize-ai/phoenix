# judge-trust-ready

The user wants to use an LLM safety judge to auto-block unsafe replies, and asks whether
it's good enough. The agent has to compare the judge's verdicts with human reviewers'
labels, compute the two numbers the user's bar is about, and make a call. The judge
meets both bars, so the right answer is turn it on.

This task is the twin of [judge-trust](../judge-trust/Task.md). The request and the
verifier are the same. Only the data differs: there the judge misses too many unsafe
replies, so the right answer is don't turn it on. Here recall is close to the bar, and
two common counting mistakes push precision past the limit, so an agent has to count
carefully and still commit to a yes.

## The request

The agent gets `instruction.md` word for word:

> We want to use our `safety_judge` eval to auto-block unsafe replies from our support assistant. Its verdicts are logged as `safety_judge` annotations on the traces in our `support-chat` project in Phoenix, and our reviewers have labeled a sample of the same traces as `human_safety`.
>
> The judge has to catch at least 90% of the replies reviewers mark unsafe, and no more than a quarter of what it blocks can be false alarms. Can we turn it on? Show me the numbers your answer is based on.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-chat` | 120 traces from a support assistant for a store that sells smart-home devices, e-bikes, and small appliances. Each has a root `support-assistant` span with the customer's message and the reply, and one LLM span. Most replies are routine. Some get around account security, share another customer's data, or encourage dangerous product use. |
| `safety_judge` annotations | One per trace, on the LLM span: `unsafe` or `safe`, with an explanation. Four judge runs failed and have no label, only an explanation such as `error: provider timeout after 30s`. |
| `human_safety` annotations | On the root span of 80 traces: `unsafe` or `safe`, with a short note on unsafe ones. The other 40 traces have no review. |

How the judge's verdicts compare with the reviewers' labels on the 80 reviewed traces:

| | Reviewer: unsafe | Reviewer: safe |
| --- | --- | --- |
| Judge: unsafe | 13 | 3 |
| Judge: safe | 1 | 60 |
| Judge run failed | 0 | 3 |

On the 77 traces with both labels, the judge catches 13 of 14 unsafe replies (92.9%
recall). Of the 16 replies it would block, 13 are unsafe (81.25% precision), so 19% of
blocks are false alarms. Both bars are met.

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

The metrics count traces that have both a reviewer label and a judge label. The three
failed runs on reviewed traces are all on replies reviewers marked safe, so counting
them as `safe` verdicts gives the same numbers. The 1.1-point tolerance allows rounding
to a whole percent.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Handling failed judge runs | Counting the 3 failed runs as blocks drops precision to 68%, past the false-alarm limit, and flips the decision. |
| Leaving out unreviewed traces | The judge flags 7 traces with no review. Counting them as false alarms drops precision to 57% and flips the decision. |
| Committing to a call near the bar | Recall (93%) is close to the 90% bar. A reply that gives the numbers but leaves the call open fails `decision`. |
| Backing the call with the right numbers | A reply that cites only 95% agreement gets the decision right but states neither metric, so it fails. |
| Matching annotations across spans | The judge annotates the LLM span and reviewers annotate the root span, so matching by span finds no pairs. |
| Not answering from habit | The twin task has the same request with the opposite answer. |

## Known limits

- Recall rests on 14 unsafe replies, so one trace moves it by 7 points. One more miss
  would put recall at 86% and flip the answer, and the data has exactly one miss.
- The replies come from templates. An agent could label traces itself, but its own labels
  wouldn't reproduce the reviewers' numbers, which is what the request asks for.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Runs the shared generator in `../judge-trust/fixture/build.py`, which writes `fixture/spec.json` and `tests/truth.json` for both tasks. |
| `tests/test.py` | The verifier, the same as `judge-trust`'s. `tests/truth.json` holds the expected values, the confusion counts, and each trace's labels. |
| `solution/solve.py` | The reference solution, the same as `judge-trust`'s. It reads both annotations from Phoenix, matches them by trace, computes recall and precision, and writes the reply. |
