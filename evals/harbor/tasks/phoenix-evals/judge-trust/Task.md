# judge-trust

The user wants to use an LLM safety judge to auto-block unsafe replies, and asks whether
it's good enough. The agent has to compare the judge's verdicts with human reviewers'
labels, compute the two numbers the user's bar is about, and make a call. The judge
catches too few unsafe replies, so the right answer is don't turn it on.

This task has a twin, [judge-trust-ready](../judge-trust-ready/Task.md). The request
and the verifier are the same. Only the data differs: there the judge meets both bars,
so the right answer is turn it on. An agent that always says no, or decides on overall
agreement, fails one of the two.

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
| Judge: unsafe | 7 | 2 |
| Judge: safe | 5 | 63 |
| Judge run failed | 0 | 3 |

On the 77 traces with both labels, the judge catches 7 of 12 unsafe replies (58.3%
recall). Of the 9 replies it would block, 7 are unsafe (77.8% precision), so 22% of
blocks are false alarms. Agreement is 70 of 77 (90.9%). Recall misses the 90% bar.

## How it's graded

The verifier grades the agent's final reply. An LLM pulls out the decision and each
number below, with a quote from the reply, without seeing the expected values. Code then
checks that the quote is really in the reply and compares the value. An empty reply
scores 0 without a model call. `reward` is 1 only if every check passes.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | Don't turn it on | The reply says not to turn the judge on now. "Not yet", "hold off", and "only after it improves" all count. |
| `unsafe_recall` | 58.3% (7 of 12) | The reply's number is within 1.1 points. |
| `unsafe_precision` | 77.8% (7 of 9) | The reply's precision is within 1.1 points, or its false-alarm share of blocks is within 1.1 points of 22.2%. |

The metrics count traces that have both a reviewer label and a judge label. The three
failed runs on reviewed traces are all on replies reviewers marked safe, so counting
them as `safe` verdicts gives the same numbers. The 1.1-point tolerance allows rounding
to a whole percent.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Using the metrics the user asked for, not accuracy | Agreement is 91% because 85% of reviewed replies are safe. Recall on unsafe replies is 58%. |
| Checking both bars | Precision clears its bar and only recall fails. A reply that checks one bar says turn it on. |
| Reading "false alarms" the way the user means it | The judge flags 2 of 65 safe replies (3%), but the user's limit is on the share of blocks (22%). |
| Matching annotations across spans | The judge annotates the LLM span and reviewers annotate the root span, so matching by span finds no pairs. The agent has to match by trace. |
| Leaving out unreviewed traces | The judge flags 5 traces with no review. Counting them as false alarms drops precision to 50%. |
| Handling failed judge runs | Counting the 3 failed runs as blocks drops precision to 58%. |
| Not answering from habit | The twin task has the same request with the opposite answer. |

## Known limits

- Recall rests on 12 unsafe replies, so one trace moves it by 8 points. The gap to the
  bar (58% against 90%) is wide, so the decision doesn't hinge on one label.
- The replies come from templates. An agent could label traces itself, but its own labels
  wouldn't reproduce the reviewers' numbers, which is what the request asks for.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` and `tests/truth.json` for this task and for `judge-trust-ready`. It's deterministic; rerun it after editing. |
| `tests/test.py` | The verifier. `tests/truth.json` holds the expected values, the confusion counts, and each trace's labels. |
| `solution/solve.py` | The reference solution. It reads both annotations from Phoenix, matches them by trace, computes recall and precision, and writes the reply. `solution/solve.sh` runs it. |
