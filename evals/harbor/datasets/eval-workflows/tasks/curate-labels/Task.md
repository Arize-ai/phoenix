# curate-labels

The agent turns reviewers' verdicts on support-bot replies into a Phoenix dataset for
testing a grounding judge. It has to find each trace's latest human verdict, leave out
traces the reviewers haven't settled, and link each example to its trace. The task tests
careful handling of annotation data: revised reviews, reviews on child spans,
`needs_review` flags, and an auto-labeler that writes to the same annotation name.

## The request

> Our reviewers have been checking support-bot replies by hand and recording their verdicts as `review` annotations on the `support-bot-reviews` project in Phoenix.
>
> Can you turn them into a dataset called `grounding-golden` that we can use to test our grounding judge? Each trace you keep becomes one example, with the customer's question and the bot's reply as input, the verdict (`supported` or `unsupported`) as the expected output, and a link back to its source span. Go by our reviewers' latest verdict on each trace, and leave out any trace they haven't settled.
>
> Tell me how many examples you included and what you left out.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-bot-reviews` | 94 traces from a support bot for an invented app, Tasklane. The root `support-bot` span has the customer's question and the bot's reply. Its children are a `get_workspace` tool call that returns the workspace record, a `search_help_center` retriever that returns the right help article and 2 others, and a `ChatCompletion` LLM call whose output is the same reply. |
| Human `review` annotations | 109 reviews from `alice`, `bob`, `carmen`, and `dmitri`, labeled `supported`, `unsupported`, or `needs_review`, each with a short note. 15 are on the LLM span and the rest are on root spans. 8 were revised after they were first written. |
| Auto-labeler `review` annotations | 27 pre-labels from `prelabel-bot`, with annotator kind `LLM`, on root spans, labeled `supported` or `unsupported`. |
| Other annotations | `user_feedback`, a human thumbs up or down, on 78 root spans, and nightly `helpfulness`, `tone`, `tool_ok`, and `retrieval_hit` evals on child spans. None of them are reviews. |
| `/app` | Empty. |

Phoenix keeps one annotation per name, span, and identifier. When a reviewer revises a
review, Phoenix updates it in place: `created_at` keeps the first review's time, and
`updated_at` moves to the revision's time. Phoenix doesn't keep the earlier label, so the
agent sees only the revision and its two timestamps.

## How the data was made

`fixture/build.py` writes all the data from hand-written templates. No model wrote any
of it.

- **Templates.** 18 help-center topics for Tasklane. Each topic has an article, the
  workspace fields it relies on, 3 questions, 2 grounded replies, and 2 replies with one
  mistake each. Each mistaken reply has 2 reviewer notes that name its mistake. Generic
  notes cover `supported` verdicts, `needs_review` flags, and wrong `unsupported`
  verdicts on grounded replies. The workspace record also names the member, so a
  personalized greeting is grounded rather than inferred from the email address.
- **Review histories.** Each trace gets one of the review histories in the following
  table, in the counts shown. Within a history, the traces alternate between
  `supported` and `unsupported`. Where a history has two variants, such as a wrong
  verdict or `needs_review`, the variants alternate in pairs, so each variant gets both
  verdicts.
- **Random seed 41.** The seed shuffles the order of the traces. For each trace, it
  picks the topic, question, reply, greeting, and sign-off; the 2 other retrieved
  articles; the seat count and start time; the 2 reviewers; whether a pre-label comes
  before or after the human reviews, where the history allows either; each reviewer
  note; and the `user_feedback` and nightly eval labels. It also shuffles the write order
  within each review round.

| Review history | Traces | In the dataset? |
| --- | --- | --- |
| One human verdict | 15 | Yes |
| Two humans agree | 3 | Yes |
| Two humans disagree, and the later one is right | 6 | Yes, with the later verdict |
| `needs_review`, then a later human verdict | 4 | Yes |
| Pre-label disagrees, written before the human verdict | 4 | Yes, with the human verdict |
| Pre-label disagrees, written after the human verdict | 4 | Yes, with the human verdict |
| Pre-label agrees with the human verdict | 4 | Yes |
| A wrong verdict, then a second reviewer's wrong verdict (2) or `needs_review` (2), then the first reviewer revises theirs to the right verdict | 4 | Yes, with the revised verdict |
| Only human review is on the LLM span; 2 of these also have a disagreeing pre-label on the root | 4 | Yes |
| A wrong verdict (2) or `needs_review` (2) on the root, then a later verdict on the LLM span | 4 | Yes, with the LLM-span verdict |
| A wrong verdict (2) or `needs_review` (2) on the LLM span, then a later verdict on the root | 4 | Yes, with the root verdict |
| Human verdict, then a second reviewer's `needs_review` | 4 | No |
| Only `needs_review` | 3 | No |
| A pre-label and a human `needs_review` | 3 | No |
| Two human verdicts, then the first reviewer revises theirs to `needs_review` | 4 | No |
| A verdict on the root, then a later `needs_review` on the LLM span | 3 | No |
| Only a pre-label | 10 | No |
| No review | 11 | No |

A trace is in the dataset when its latest human review is `supported` or `unsupported`,
and that review's label is the expected verdict. A `supported` reply restates only the
help article and the workspace record. An `unsupported` reply adds or contradicts a fact,
and the correct reviewer's note names the mistake. That puts 56 traces in the dataset,
29 `supported` and 27 `unsupported`. The other 38 are left out: 17 are still open for
review, 10 have only a pre-label, and 11 were never reviewed.

The seeder writes annotations one at a time in file order. `build.py` orders them in
rounds: early pre-labels, first reviews, the other annotations, second reviews,
revisions, and late pre-labels. Phoenix stores times to the second, and the seeder waits
for the next second before it writes an annotation name to a span a second time. At each
boundary between human review rounds, `build.py` puts two writes to the same span, so every
review in a later round gets a later second than every review in an earlier round, even
on another span of the same trace.

`build.py` raises an error in these cases:

- A trace's question, reply, retrieved documents, workspace record, or system prompt
  contains a verdict word or one of that trace's review notes.
- A trace's latest human review doesn't give its planned verdict, or doesn't leave the
  trace out as planned.
- It can't put two writes to one span at a boundary between review rounds.

It also redraws a trace's text until no two traces share both a question and a reply, so
deduplicating examples by text never drops a trace. GPT-6 Astra checked the templates and
the labels they produce.

## How it's graded

The verifier reads the latest version of `grounding-golden`. An example links to a trace
through Phoenix's own span link, which the dataset gets when it's created from spans, or
through a metadata field whose name ends in `span_id` or `trace_id`. A link to any span
in the trace counts.

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `settled_traces` | Code | `grading_data.json` | Every example links to one trace in the project, and the linked traces are exactly the 56 traces whose latest human review is a verdict, each once. |
| `latest_verdicts` | Code | `grading_data.json` | Every example linked to a trace has an output that gives its trace's latest human verdict: the word `supported` or `unsupported`, or a true or false value under a key containing `support` or `ground`, such as `{"supported": true}`. An output that gives both fails. |
| `inputs` | Code | `grading_data.json` | Every example linked to a trace has an input that contains the question and the reply, ignoring case and spacing. No input contains a verdict word, a key such as `label`, `verdict`, or `review`, or one of its trace's review notes. |

`reward` is 1 only when every check passes. The reply isn't graded; the dataset is the
deliverable. `details.json` lists the missing, extra, repeated, and mislabeled traces by
review history.

These measures are reported beside `reward` and don't affect it:

- `turn_count`: the number of steps in the agent's trajectory.
- `tool_count`: the number of tool calls the agent made.
- `loaded_<skill>`: 1 if the agent loaded that skill.

## What the task tests

| Wrong approach | Fails |
| --- | --- |
| Orders reviews by `created_at`. A revised review keeps its `created_at`, so the other reviewer's review looks latest. | `settled_traces`, `latest_verdicts` |
| Reads only reviews on root spans. | `settled_traces`, `latest_verdicts` |
| Takes the first human review. | `settled_traces`, `latest_verdicts` |
| Takes the last review in the API's list. The API lists annotations newest first by when they were first written, so the last one is the oldest. | `settled_traces`, `latest_verdicts` |
| Treats the auto-labeler as a reviewer. | `settled_traces`, `latest_verdicts` |
| Skips `needs_review` and takes the latest verdict before it. | `settled_traces` |
| Falls back to the pre-label when no human reviewed the trace. | `settled_traces` |
| Takes the latest human annotation of any name, such as `user_feedback`. | `settled_traces` |
| Copies the verdict into the input. | `inputs` |
| Leaves out the link to the trace. | All three |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Each wrong approach in
the previous table, scripted against the seeded data, scores 0, and valid variations,
such as linking only through a metadata `trace_id`, writing `{"supported": true}` as the
output, or deduplicating by question and reply, score 1.

## Known limits

- No review sits on the tool or retriever spans, so an agent that reads only the root
  and LLM spans still passes.
- The task needs no judgment calls, and the reference solution makes no model calls. A
  pass shows careful data handling, not grading skill.
- `inputs` fails any input key that contains `label`, `verdict`, `review`, `annotation`,
  `explanation`, `expected`, `supported`, or `grounded`, even a harmless one such as
  `reply_under_review`.
