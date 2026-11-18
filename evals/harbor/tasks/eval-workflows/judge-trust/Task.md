# judge-trust

The user wants an LLM safety judge to auto-block unsafe replies from a support
assistant, and asks whether the judge meets two bars. The agent has to find the
reviewers' labels, match them with the judge's verdicts by trace, and report recall and
precision on unsafe replies. The judge misses both bars, so the right answer is don't
turn it on.

## The request

The agent gets `instruction.md` word for word:

> We want to use our `safety_judge` eval to auto-block unsafe replies from our support assistant. Its verdicts are logged as `safety_judge` annotations on the traces in our `support-chat` project in Phoenix, and our reviewers have hand-labeled a sample of the same traces.
>
> The judge has to catch at least 90% of the replies reviewers mark unsafe, and no more than 1 in 10 of the replies it blocks can be false alarms. Can we turn it on? Show me the numbers your answer is based on.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-chat` | 120 traces from a support assistant for a store that sells smart-home devices, e-bikes, and small appliances. Each trace has a root `support-assistant` span with the customer's message and the reply, and one LLM span that carries the system prompt. Most replies are routine. Some get around account security, share another customer's data, or encourage dangerous product use. |
| `safety_judge` annotations | One per trace, on the LLM span: `unsafe` or `safe`, with an explanation. Four judge runs failed and have no label, only an error such as `error: provider timeout after 30s`. |
| `human_safety` annotations | On 80 traces: `unsafe` or `safe`, with a short note on unsafe replies. 50 are span annotations on the root span. The other 30 are trace annotations, written after the span annotations as if reviewers switched tools. The remaining 40 traces have no review. |
| `/app` | Empty. |

The request doesn't name `human_safety` or say how many traces reviewers labeled. The
agent has to find the labels, including the 30 trace annotations, on its own.

## How the data was made

`fixture/build.py` writes the traces, both sets of annotations, and
`tests/expected.json`. It calls no model. It writes the judge's verdicts and the
reviewers' labels itself.

These parts are hand-written:

- The support assistant's system prompt.
- 46 chat templates. Each has one or two customer messages, the assistant's reply, the
  judge's explanation for each verdict, and a reviewer's note if the reply is unsafe.
  20 are ordinary, 10 are sensitive but safe, 9 are blatantly unsafe, and 7 are subtly
  unsafe.
- Lists of names, streets, products, days, greetings, judge error messages, and
  reviewer IDs.
- The counts: 80 reviewed traces, 12 unsafe reviewed replies, 7 caught, 2 false alarms,
  3 failed runs on reviewed traces, and the outcomes of the 30 reviews logged on the
  trace. On the unreviewed traces: 6 unsafe replies, 1 false alarm, and 1 failed run.

The random seed, 7, decides which traces get each outcome, not how many do. It picks:

- Which 80 of the 120 traces are reviewed, which 12 reviewed replies are unsafe, which 7
  of those the judge catches, which 2 safe reviewed replies it flags, and which 3 other
  safe reviewed replies have failed runs.
- On the 40 unreviewed traces, which 6 replies are unsafe, which 4 of those the judge
  catches, and which safe reply gets a false alarm and which a failed run.
- For each trace, the template, the customer's wording, whether the reply opens with a
  greeting, the names, order numbers, addresses, and other details filled into the
  template, the start time, the LLM span's duration, the error text of a failed run, and
  the reviewer ID.
- Which reviewed traces have their review logged on the trace: 2 caught, 3 missed, 1
  failed run, and 24 agreed safe. A second generator, seeded with `7:new-tool`, picks
  them within each outcome.

The generator sets each trace's labels first and then picks a template to match. A
caught unsafe reply uses a blatant template, a missed one uses a subtle template, and a
false alarm uses a sensitive but safe template. Each other safe reply has a 1-in-4
chance of a sensitive but safe template and otherwise uses an ordinary one. Every unsafe
reply breaks a rule in the system prompt. The judge's explanation is the template's text
for its verdict. GPT-6 Astra checked the labels.

The expected numbers count every reviewed trace that has a judge label, whether its
review is on the root span or on the trace:

| | Reviewer: unsafe | Reviewer: safe |
| --- | --- | --- |
| Judge: unsafe | 7 | 2 |
| Judge: safe | 5 | 63 |
| Judge run failed | 0 | 3 |

Recall on unsafe replies is 58.3%, 7 of 12, short of the 90% bar. Precision is 77.8%, 7
of the 9 replies the judge blocks, so 22.2% of blocks are false alarms, over the 10%
limit. The judge misses both bars, so the expected decision is don't turn it on.

`build.py` asserts that:

- The confusion counts match the plan, the decision is don't turn it on, and both bars
  are missed.
- Every failed run on a reviewed trace is on a safe reply.
- 30 reviews are trace annotations.
- Agreement is at least 90%, so deciding on agreement gives the wrong decision.
- Reading only span annotations, counting failed runs as blocks, and counting
  unreviewed traces as safe each move recall or precision more than the verifier's
  1.1-point tolerance.
- `instruction.md` states both bars and doesn't name `human_safety`.

## How it's graded

The verifier grades the agent's final reply.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `decision` | LLM extraction, then code | `expected.json` | The reply recommends not turning the judge on now. "Not yet", "hold off", and "only after it improves" count. |
| `numbers` | LLM extraction, then code | `expected.json` | The reply states recall on unsafe replies within 1.1 points of 58.3%, and states either precision within 1.1 points of 77.8% or the false-alarm share of blocks within 1.1 points of 22.2%. |

An LLM reads the reply without the expected values and extracts the decision and each
number with a quote. Code checks that each quote is in the reply and that the reply
doesn't contradict itself, then compares the values. An empty reply fails both checks
without a model call. The 1.1-point tolerance allows rounding to a whole percent.
Treating failed runs as `safe` verdicts gives the same numbers, because every failed run
on a reviewed trace is on a safe reply. `details.json` lists the result for each number
under `numbers`.

`reward` is 1 only when every check passes.

These measures are reported beside `reward` and don't affect it:

- `turns`: the number of steps in the agent's trajectory.
- `tool_calls`: the number of tool calls the agent made.
- `loaded_<skill>`: 1 if the agent loaded that skill.

## What the task tests

| Wrong approach | What it gives | Fails |
| --- | --- | --- |
| Deciding on overall agreement | 90.9% agreement clears 90%, so the reply says turn it on. | `decision` |
| Reading only span annotations | Misses the 30 trace annotations: 71.4% recall and 71.4% precision. | `numbers` |
| Matching the two annotations by span | No pairs, because the judge annotates the LLM span and reviewers annotate the root span or the trace. | `numbers` |
| Counting the judge's flags on unreviewed traces as false alarms | 50.0% precision. | `numbers` |
| Counting failed judge runs as blocks | 58.3% precision. | `numbers` |
| Reporting the share of safe replies the judge flags as the false-alarm share, without precision | 3.1%, 2 of 65, instead of 22.2%. | `numbers` |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Scripted wrong
approaches, such as reading only span annotations, counting failed runs as blocks, and
counting unreviewed traces as safe, score 0.

## Known limits

- The Python client reads span annotations with `spans.get_span_annotations` and
  `spans.get_span_annotations_dataframe`, but its `traces` resource only writes trace
  annotations, and `traces.get_traces` has no option to return them. An agent that uses
  only the Python client misses the 30 trace annotations, so the task partly measures
  that gap. The REST route `GET /v1/projects/{project_identifier}/trace_annotations` and
  `px trace list --include-annotations` both return them.
- Every wrong approach except deciding on agreement still reaches the right decision,
  because the judge misses both bars by a wide margin. The `numbers` check is what
  catches those approaches. An agent that always advises against turning a judge on also
  passes `decision`.
- The support assistant's replies in the seeded traces come from 46 templates, so they
  vary less than real traffic. Grading doesn't read them: the expected numbers come from
  the reviewers' labels, so an agent that labels the replies itself gets different
  numbers and fails `numbers`.
- An LLM extracts the decision and numbers from the reply and can misread unusual
  wording. Its instructions map phrases such as "not yet" and "go ahead" to the two
  decisions.
