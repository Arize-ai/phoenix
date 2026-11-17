# curate-labels

The user's reviewers have labeled support-bot replies in Phoenix, and the user wants
those labels turned into a dataset for testing a grounding judge. The agent has to pick
the right review for each trace, leave out traces that don't qualify, and build the
dataset with links back to the traces. The verifier checks the dataset.

## The request

The agent gets `instruction.md` word for word:

> Our reviewers have been checking support-bot replies in Phoenix, and their verdicts are the `review` annotations on the `support-bot-reviews` project.
>
> Can you turn them into a dataset called `grounding-golden` that we can use to test our grounding judge? Each trace you keep becomes one example, with the customer's question and the bot's reply as input, the verdict (`supported` or `unsupported`) as the expected output, and a link back to its source span. Go by each trace's most recent human review, and skip traces where that review is still `needs_review` and traces that only have the auto-labeler's pre-label.
>
> Tell me how many examples you included and what you left out.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `support-bot-reviews` | 98 traces from a SaaS support bot. The root `support-bot` span has the customer's question and the bot's reply. Its children are a `get_workspace` tool call (the plan and workspace record), a `search_help_center` retriever (the right help article and 2 others), and the LLM call (`ChatCompletion`), whose output is the same reply. |
| `review` annotations | Mostly on root spans. Reviewers annotate whichever span they have open, so 15 human reviews sit on the LLM span instead. Human reviews come from `alice`, `bob`, `carmen`, or `dmitri`, labeled `supported`, `unsupported`, or `needs_review`, each with a short note. Pre-labels come from the auto-labeler, `prelabel-bot`, on root spans, labeled `supported` or `unsupported`. |
| Other annotations | `user_feedback` (a human thumbs up or down) on most root spans, and nightly `helpfulness`, `tone`, `tool_ok`, and `retrieval_hit` evals on child spans. None of them are reviews. |

Phoenix keeps one annotation per name, span, and identifier. When a reviewer revises a
review, Phoenix updates it in place: `created_at` keeps the first review's time, and
`updated_at` moves to the revision's time. So two human reviews on one span come from
two different reviewers, and 8 reviews show a later `updated_at` than `created_at`.
Each trace's review history is built on purpose:

| Review history | Traces | In the dataset? |
| --- | --- | --- |
| One human verdict | 15 | Yes |
| Two humans agree | 3 | Yes |
| Two humans disagree, and the later one is right | 6 | Yes, with the later verdict |
| `needs_review`, then a later human verdict | 4 | Yes |
| Pre-label disagrees, written before the human verdict | 4 | Yes, with the human verdict |
| Pre-label disagrees, written after the human verdict | 4 | Yes, with the human verdict |
| Pre-label agrees with the human verdict | 4 | Yes |
| Two pairs of traces with the same question and reply | 4 | Yes, all four |
| A wrong verdict, then a second reviewer's wrong verdict (2) or `needs_review` (2), then the first reviewer revises theirs to the right verdict | 4 | Yes, with the revised verdict |
| Only human review is on the LLM span; 2 of these also have a disagreeing pre-label on the root | 4 | Yes |
| A wrong verdict (2) or `needs_review` (2) on the root, then a later verdict on the LLM span | 4 | Yes, with the LLM-span verdict |
| A wrong verdict (2) or `needs_review` (2) on the LLM span, then a later verdict on the root | 4 | Yes, with the root verdict |
| Human verdict, then a later `needs_review` | 4 | No |
| Only `needs_review` | 3 | No |
| Only a pre-label | 10 | No |
| A pre-label and a human `needs_review` | 3 | No |
| Two human verdicts, then the first reviewer revises theirs to `needs_review` | 4 | No |
| A verdict on the root, then a later `needs_review` on the LLM span | 3 | No |
| No review | 11 | No |

That leaves 60 eligible traces: 31 `supported` and 29 `unsupported`.

## How the data was made

`fixture/build.py` generates the data from hand-written templates and the fixed random
seed 41. The templates cover 18 help-center topics for an invented app, Tasklane. Each
topic has an article, the workspace fields it relies on, 3 questions, 2 grounded
replies, and 2 replies with a mistake, each with 2 reviewer notes that name it. The seed
gives each trace a category and a true verdict, then picks its text, its reviewers, and
the order the annotations are written in. No model wrote anything; the generator writes
the replies, reviews, and pre-labels. No public datasets or user data are used, and all
names and companies are invented.

Each eligible trace's latest human verdict is correct by construction. A `supported`
reply restates only the help article and the workspace record. An `unsupported` reply
adds or contradicts a fact, and its reviewer's note names that mistake.

These checks cover the data:

- The generator raises an error if a trace's question, reply, retrieved documents,
  workspace record, or system prompt contains a verdict word or one of its review notes.
  It also raises an error if it can't put two writes to one span at a boundary between
  review rounds, which keeps every later round at a later second.
- The seeder waits until every span is in Phoenix, then writes the annotations one at a
  time in file order.
- On November 13, 2026, GPT-6 Astra reviewed the data and labels read-only through
  Codex. It found that review notes were sampled by label alone, so an `unsupported`
  note could name a mistake the reply doesn't make. Commit `5932c12ed5` gave each bad
  reply its own notes and limited the generic notes to wording that fits any reply. No
  verdict or eligible trace changed.
- In Docker, the reference solution scores 1 and a do-nothing agent scores 0. The
  controls in "What the task tests" show what naive approaches score.

## How it's graded

`reward` is 1 only if every check passes. The verifier reads the latest version of
`grounding-golden`. An example can link to its trace in two ways: Phoenix's own span
link (set when the dataset is created from spans), or a metadata field whose name ends
in `span_id` or `trace_id`. A link to any span in the trace counts.

| Check | Passes when |
| --- | --- |
| `linked_to_traces` | Every example links to exactly one trace in the project. |
| `correct_traces` | The linked traces are exactly the 60 eligible traces, each once. |
| `correct_labels` | Every example's output gives its trace's latest human verdict: the word `supported` or `unsupported`, or a true or false value under a key containing `support` or `ground`, such as `{"supported": true}`. An output that gives both fails. |
| `correct_inputs` | Every example's input contains the question and the reply, ignoring case and spacing. |
| `no_label_in_input` | No input contains a verdict word, a key such as `label`, `verdict`, or `review`, or the reviewer's note for that trace. |

The reply isn't graded; the dataset is the deliverable. The run also reports `turns`,
`tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Taking the latest human review | Two humans disagree on some traces, and `needs_review` comes before or after a verdict on others. The Phoenix API lists annotations newest first by when they were first written, so an agent that lets the last one in the list win takes the oldest. |
| Reading revised reviews | A revised review keeps its `created_at` and its place in the API's list, but its `updated_at` is later than the other reviewer's review. An agent that orders reviews by `created_at` takes the other reviewer's wrong verdict or `needs_review` on 4 traces, and includes 4 traces that the first reviewer reopened. |
| Reading reviews on every span | An agent that reads only root-span annotations leaves out the 4 traces whose only human review is on the LLM span, goes by the older root review on 4 traces with a later LLM-span verdict, and includes the 3 traces with a later `needs_review` on the LLM span. |
| Ignoring the auto-labeler | Pre-labels written after the human verdict disagree with it, and pre-label-only traces aren't eligible. |
| Not falling back to the pre-label | Traces with only a pre-label, or a pre-label and a `needs_review`, must be left out. |
| Respecting a later `needs_review` | A human verdict followed by `needs_review` means the trace is back in review, so it's left out. |
| Keeping distinct traces that look the same | Two pairs of traces share the same question and reply. Deduplicating by text drops two eligible traces. |
| Reading only reviews | `user_feedback` annotations are human but aren't reviews. |
| Keeping the label out of the input | The `no_label_in_input` check. |

Controls we ran locally against the seeded data:

| Control | Reward | Failing checks |
| --- | --- | --- |
| No dataset (nop) | 0 | All |
| Reference solution | 1 | None |
| Span link only, metadata `trace_id` only, a DataFrame with `span_id_key`, or `{"supported": true}` as output | 1 | None |
| Latest human review by `created_at` | 0 | `correct_traces`, `correct_labels` |
| Root-span reviews only | 0 | `correct_traces`, `correct_labels` |
| First human review | 0 | `correct_traces`, `correct_labels` |
| Annotations in API order, last one wins | 0 | `correct_traces`, `correct_labels` |
| Latest review of any kind | 0 | `correct_traces`, `correct_labels` |
| Latest human review that isn't `needs_review` | 0 | `correct_traces` |
| Human verdict, else the pre-label | 0 | `correct_traces` |
| Deduplicate by question and reply | 0 | `correct_traces` |
| Latest human annotation of any name | 0 | `correct_traces` |
| Verdict copied into the input | 0 | `no_label_in_input` |
| No link | 0 | All |
| The 4 pilot agents' pipelines, replayed from their trajectories (root-span reviews only, latest by `created_at`) | 0 | `correct_traces`, `correct_labels` |

## Known limits

- Phoenix stores annotation times to the second. Before the seeder writes an annotation
  name to a span a second time, it waits for the next second, so a span's reviews and
  revisions never share a time. Reviews on two spans of one trace don't get that wait.
  To order them, the fixture puts two writes to the same span at each boundary between
  review rounds, which puts every review in a later round at a later second. The whole
  review history seeds in a few seconds, so a trace's reviews are often one second
  apart.
- Phoenix doesn't keep a revised review's earlier verdict. The agent sees only the
  revision and its two timestamps.
- Reviews off the root span sit only on the LLM span, and revisions sit only on root
  spans. An agent that reads the root and LLM spans but skips the tool and retriever
  spans still passes.
- The task needs no judgment calls, so the reference solution makes no model calls. It
  tests careful data handling, not grading skill.
- `unsupported` replies are shorter than `supported` ones: across the 60 eligible traces
  they average 144 characters against 196. The second-model review flagged this cue,
  and it isn't fixed. It can't earn reward here, but a grounding judge that favors long
  replies would look better on `grounding-golden` than it should.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/phoenix_seed.json` (the traces and annotations, in the order they're written) and `tests/truth.json` (the eligible traces, verdicts, texts, and notes). It's deterministic; rerun it after editing. |
| `tests/test.py` | The verifier. |
| `solution/curate_labels.py` | The reference solution. It reads every span and its `review` annotations with the Phoenix client, takes each trace's latest human review by `updated_at`, and creates the dataset with links to the root spans. `solution/solve.sh` runs it. |
