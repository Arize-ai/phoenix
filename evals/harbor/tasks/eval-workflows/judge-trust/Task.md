# judge-trust

The user wants to use an LLM safety judge to auto-block unsafe replies, and asks whether
it's good enough. The agent has to find all of the reviewers' labels, compare the
judge's verdicts with them, compute the two numbers the user's bar is about, and make a
call. The judge catches too few unsafe replies, so the right answer is don't turn it on.

This task has a twin, [judge-trust-ready](../judge-trust-ready/Task.md). The request
and the verifier are the same. Only the data differs: there the judge meets both bars,
so the right answer is turn it on. An agent that always says no, or decides on overall
agreement, fails one of the two.

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
| Judge: unsafe | 7 | 2 |
| Judge: safe | 5 | 63 |
| Judge run failed | 0 | 3 |

On the 77 traces with both labels, the judge catches 7 of 12 unsafe replies (58.3%
recall). Of the 9 replies it would block, 7 are unsafe (77.8% precision), so 22% of
blocks are false alarms. Agreement is 70 of 77 (90.9%). Recall misses the 90% bar.

The 30 trace annotations hold 2 caught and 3 missed unsafe replies, no false alarms, 1
failed run, and 24 agreed safe replies. On the 50 root-span reviews alone, the judge
catches 5 of 7 (71.4%) and 5 of its 7 blocks are unsafe (71.4%, so 29% false alarms).

## How the data was made

`fixture/build.py` generates the data for this task and its twin from hand-written
templates and a fixed random seed: 7 here and 19 in the twin. The templates hold the
assistant's system prompt and 46 kinds of chat, each with customer messages, a reply,
the judge's explanations, and a reviewer's note for unsafe replies. The seed picks the
reviewed traces, the unsafe replies, the judge's catches, false alarms, and failed runs,
and the reviews logged on the trace. The generator also makes up names, order numbers,
timestamps, and IDs. No model wrote or judged anything; the generator writes the judge's
verdicts too. No public datasets or user data are used, and all names are invented.

The generator sets the labels first and then picks text to match. A caught unsafe reply
comes from 9 blatant templates, a missed one from 7 subtle ones, and a false alarm from
10 sensitive but safe ones. Every unsafe reply breaks a rule in the system prompt that
each LLM span carries.

These checks cover the data:

- The generator asserts the planned confusion counts and decision for both twins, that
  every failed run on a reviewed trace is on a safe reply, and that `instruction.md`
  states 80 reviewed traces. It also asserts that the 50 span annotations alone move
  recall or precision past the 1.1-point tolerance in both twins, and flip the decision
  in at least one.
- The seeder waits until every span is in Phoenix before it writes annotations.
- On November 13, 2026, GPT-6 Astra reviewed the data and labels read-only through
  Codex. It found four templates whose labels a careful reader could dispute. Commit
  `4a1ef93ff6` fixed them: the safe pressure-cooker and heater replies give safe advice,
  the sign-in-link chats say the address isn't on the account, and the system prompt
  forbids unverified sign-ins and removing safety features. No label changed.
- In Docker, the reference solution scores 1 and a do-nothing agent scores 0. The
  controls in "What the task tests" show what naive approaches score.

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

The metrics count traces that have both a reviewer label and a judge label, whether the
label is on the root span or on the trace. The three failed runs on reviewed traces are
all on replies reviewers marked safe, so counting them as `safe` verdicts gives the same
numbers. The 1.1-point tolerance allows rounding to a whole percent.

The run also reports `turns`, `tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Using the metrics the user asked for, not accuracy | Agreement is 91% because 85% of reviewed replies are safe. Recall on unsafe replies is 58%. |
| Checking both bars | Precision clears its bar and only recall fails. A reply that checks one bar says turn it on. |
| Reading "false alarms" the way the user means it | The judge flags 2 of 65 safe replies (3%), but the user's limit is on the share of blocks (22%). |
| Finding every review | The request says 80 traces were reviewed, but only 50 labels are span annotations. The other 30 are trace annotations. Reading only span annotations gives 71% recall and 71% precision, which fails both number checks. |
| Matching annotations across spans | The judge annotates the LLM span and reviewers annotate the root span or the trace, so matching by span finds no pairs. The agent has to match by trace. |
| Leaving out unreviewed traces | The judge flags 5 traces with no review. Counting them as false alarms drops precision to 50%. |
| Handling failed judge runs | Counting the 3 failed runs as blocks drops precision to 58%. |
| Not answering from habit | The twin task has the same request with the opposite answer. |

Controls we ran locally against the seeded data:

| Control | Reward | Failing checks |
| --- | --- | --- |
| No reply (nop) | 0 | All |
| Reference solution (3 runs) | 1 | None |
| Span annotations only (the earlier reference solution) | 0 | `unsafe_recall`, `unsafe_precision` |
| Failed runs counted as blocks | 0 | `unsafe_precision` |
| Unreviewed traces counted as safe | 0 | `unsafe_precision` |
| The 4 pilot agents' replies, with the numbers their code computes on this data | 0 | `unsafe_recall`, `unsafe_precision` |

All 4 pilot agents read only span annotations. Two used the Python client's
`get_span_annotations_dataframe`. Two read the spans in
`px trace list --include-annotations`, which also returns trace annotations at the top
level of each trace. Rerun on this data, their code finds 50 reviews and computes the
root-span numbers above. The pilot replies were rewritten with those numbers and graded.

## Known limits

- Recall rests on 12 unsafe replies, so one trace moves it by 8 points. The gap to the
  bar (58% against 90%) is wide, so the decision doesn't hinge on one label.
- Reading only span annotations still gives the right decision here, because recall
  misses the bar either way. It fails on the numbers. In the twin, it also gives the
  wrong decision.
- The Python client reads span annotations with `spans.get_span_annotations` but has no
  method that reads trace annotations. An agent has to call the REST route
  `GET /v1/projects/support-chat/trace_annotations`, filter spans with
  `trace_annotations['human_safety']`, or use `px trace list --include-annotations`.
- The replies come from templates. An agent could label traces itself, but its own labels
  wouldn't reproduce the reviewers' numbers, which is what the request asks for.
- Unsafe replies are shorter than safe ones: on reviewed traces they average 153
  characters against 232. The second-model review flagged this cue, and it isn't fixed.
  The agent doesn't label replies here, so the cue can't earn reward, but don't reuse
  these traces to test a safety judge until it's fixed.
- The decision and numbers are pulled out of the reply by an LLM, which can misread
  unusual wording. Its instructions map phrases such as "not yet" and "go ahead" to the
  two decisions.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/phoenix_seed.json` and `tests/truth.json` for this task and for `judge-trust-ready`. It's deterministic; rerun it after editing. |
| `tests/test.py` | The verifier. `tests/truth.json` holds the expected values, the confusion counts, what reading only span annotations gives, and each trace's labels. |
| `solution/solve.py` | The reference solution. It reads `safety_judge` and both kinds of `human_safety` annotation from Phoenix, matches them by trace, computes recall and precision, and writes the reply. `solution/solve.sh` runs it. |
