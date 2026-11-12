# judge-trust

Decide from reviewer labels whether an LLM safety judge is good enough to auto-block
replies. Workflow: **decide whether to trust an LLM judge**.

This task pairs with [judge-trust-ready](../judge-trust-ready/Task.md). Both get the
same request; here the right answer is don't turn it on, and there it's turn it on.

## The request

The agent receives `instruction.md` verbatim:

> We want to use our `safety_judge` eval to auto-block unsafe replies from our support assistant. Its verdicts are logged as `safety_judge` annotations on the traces in our `support-chat` project in Phoenix, and our reviewers have labeled a sample of the same traces as `human_safety`.
>
> The judge has to catch at least 90% of the replies reviewers mark unsafe, and no more than a quarter of what it blocks can be false alarms. Can we turn it on? Show me the numbers your answer is based on.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `support-chat` | 120 traces of a support chat assistant for a store that sells smart-home devices, e-bikes, and small appliances. Root `support-assistant` AGENT span (input: customer message; output: reply) and one `ChatCompletion` LLM span. Most replies are routine; some bypass account security, share another customer's data, or encourage dangerous product use. |
| `safety_judge` annotations | One per trace, on the **LLM span**. Annotator kind `LLM`, label `unsafe` or `safe`, score 1 for safe and 0 for unsafe, and an explanation. Four runs failed: no label, and an explanation such as `error: provider timeout after 30s`. |
| `human_safety` annotations | On the **root span** of 80 traces. Annotator kind `HUMAN`, label `unsafe` or `safe`; unsafe labels carry a short reviewer note. The other 40 traces are unreviewed. |

The judge's verdicts against reviewers' labels, on the 80 reviewed traces:

| | Reviewer: unsafe | Reviewer: safe |
| --- | --- | --- |
| Judge: unsafe | 7 | 2 |
| Judge: safe | 5 | 63 |
| Judge run failed | 0 | 3 |

On the 77 traces with both labels, recall on unsafe is 7/12 = 0.583, precision on
unsafe is 7/9 = 0.778 (22% of blocks are false alarms), and accuracy is 70/77 = 0.909.
Recall misses the 90% bar, so the answer is don't turn it on.

## How it's graded

The final reply is graded. An LLM extracts each claim below with a verbatim quote,
without seeing the expected values; code checks that the quote is in the reply and
compares the value. `reward` is 1 only when every check passes. An empty reply scores 0
without a model call.

| Check | Expected | Passes when |
| --- | --- | --- |
| `decision` | `dont_turn_on` | The reply recommends not turning the judge on now (no, not yet, hold off, only after it improves). |
| `unsafe_recall` | 0.583 (7 of 12) | The stated recall is within 0.011. |
| `unsafe_precision` | 0.778 (7 of 9) | The stated precision is within 0.011, or the stated false-alarm share of blocks is within 0.011 of 0.222. |

The metrics count traces with a reviewer label and a successful judge label. All three
failed judge runs on reviewed traces are on replies reviewers marked safe, so counting
them as `safe` verdicts instead of leaving them out gives the same recall and precision.
The 0.011 tolerance allows rounding to a whole percent.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Deciding on accuracy | Accuracy is 91% because 85% of reviewed replies are safe; recall on unsafe is 58%. |
| Checking only the false-alarm bar | Precision (78%) clears the bar; only recall fails. A reply that checks one threshold says turn it on. |
| Reading "false alarms" as the false-positive rate | The judge flags 2 of 65 safe replies (3%), but the request limits the share of blocks (22%). |
| Joining annotations by span | The judge annotates the LLM span and reviewers annotate the root span, so a span-level join finds no pairs. |
| Treating unreviewed traces as safe | The judge flags 5 unreviewed traces; counting them as false alarms drops precision to 50%. |
| Treating failed judge runs as blocks | Counting the 3 failed runs as unsafe verdicts drops precision to 58%. |
| A fixed answer | `judge-trust-ready` has the same request with the opposite answer. |

## Known limits

- Recall rests on 12 reviewer-unsafe replies, so one trace moves it by 8 points. The gap
  to the bar (58% against 90%) is wide, so the decision doesn't hinge on one label.
- Replies come from templates. An agent could relabel traces itself, but its own labels
  wouldn't reproduce the reviewers' numbers, which the request asks for.
- Claim extraction is an LLM call and can misread unusual phrasing. The field
  definitions map phrasing such as "not yet" and "go ahead" to the two decisions.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` and `tests/truth.json` for this task and for `judge-trust-ready`. Rerun it after editing; it's deterministic. |
| `tests/test.py` | The verifier. `tests/truth.json` holds the expected values, the confusion counts, and each trace's labels. |
| `solution/solve.py` | Reference solution: reads both annotations from Phoenix, matches them by trace, computes recall and precision, and writes the reply. `solution/solve.sh` runs it. |
