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
| Project `support-bot-reviews` | 90 traces from a SaaS support bot. The root `support-bot` span has the customer's question and the bot's reply. Its children are a `get_workspace` tool call (the plan and workspace record), a `search_help_center` retriever (the right help article and 2 others), and the LLM call. |
| `review` annotations | On root spans. Human reviews come from `alice`, `bob`, `carmen`, or `dmitri`, labeled `supported`, `unsupported`, or `needs_review`, each with a short note. Pre-labels come from the auto-labeler, `prelabel-bot`, labeled `supported` or `unsupported`. |
| Other annotations | `user_feedback` (a human thumbs up or down) on most root spans, and nightly `helpfulness`, `tone`, `tool_ok`, and `retrieval_hit` evals on child spans. None of them are reviews. |

Phoenix keeps one annotation per name, span, and identifier, so a trace with two human
reviews has them from two different reviewers. Each trace's review history is built on
purpose:

| Review history | Traces | In the dataset? |
| --- | --- | --- |
| One human verdict | 23 | Yes |
| Two humans agree | 3 | Yes |
| Two humans disagree, and the later one is right | 6 | Yes, with the later verdict |
| `needs_review`, then a later human verdict | 4 | Yes |
| Pre-label disagrees, written before the human verdict | 4 | Yes, with the human verdict |
| Pre-label disagrees, written after the human verdict | 4 | Yes, with the human verdict |
| Pre-label agrees with the human verdict | 4 | Yes |
| Two pairs of traces with the same question and reply | 4 | Yes, all four |
| Human verdict, then a later `needs_review` | 4 | No |
| Only `needs_review` | 3 | No |
| Only a pre-label | 13 | No |
| A pre-label and a human `needs_review` | 3 | No |
| No review | 15 | No |

That leaves 52 eligible traces: 27 `supported` and 25 `unsupported`. Each eligible
trace's latest human verdict is correct by construction. A `supported` reply restates
only the help article and the workspace record. An `unsupported` reply adds or
contradicts a fact, and its reviewer's note names that mistake.

## How it's graded

`reward` is 1 only if every check passes. The verifier reads the latest version of
`grounding-golden`. An example can link to its trace in two ways: Phoenix's own span
link (set when the dataset is created from spans), or a metadata field whose name ends
in `span_id` or `trace_id`. A link to any span in the trace counts.

| Check | Passes when |
| --- | --- |
| `linked_to_traces` | Every example links to exactly one trace in the project. |
| `correct_traces` | The linked traces are exactly the 52 eligible traces, each once. |
| `correct_labels` | Every example's output gives its trace's latest human verdict: the word `supported` or `unsupported`, or a true or false value under a key containing `support` or `ground`, such as `{"supported": true}`. An output that gives both fails. |
| `correct_inputs` | Every example's input contains the question and the reply, ignoring case and spacing. |
| `no_label_in_input` | No input contains a verdict word, a key such as `label`, `verdict`, or `review`, or the reviewer's note for that trace. |

The reply isn't graded; the dataset is the deliverable. The run also reports `turns`,
`tool_calls`, and which skills the agent loaded. See the
[suite README](../README.md#what-a-run-reports).

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Taking the latest human review | Two humans disagree on some traces, and `needs_review` comes before or after a verdict on others. The Phoenix API lists annotations newest first, so an agent that lets the last one in the list win takes the oldest. |
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
| First human review | 0 | `correct_traces`, `correct_labels` |
| Annotations in API order, last one wins | 0 | `correct_traces`, `correct_labels` |
| Latest review of any kind | 0 | `correct_traces`, `correct_labels` |
| Latest human review that isn't `needs_review` | 0 | `correct_traces` |
| Human verdict, else the pre-label | 0 | `correct_traces` |
| Deduplicate by question and reply | 0 | `correct_traces` |
| Latest human annotation of any name | 0 | `correct_traces` |
| Verdict copied into the input | 0 | `no_label_in_input` |
| No link | 0 | All |

## Known limits

- Phoenix stores annotation times to the second. The seeder writes about 430 other
  annotations between the first and second rounds of human reviews, which keeps a
  trace's two reviews in different seconds at normal seeding speed. A much faster seed
  could give two reviews the same time. Their row IDs still order them.
- The task needs no judgment calls, so the reference solution makes no model calls. It
  tests careful data handling, not grading skill.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the traces and annotations, in the order they're written) and `tests/truth.json` (the eligible traces, verdicts, texts, and notes). It's deterministic; rerun it after editing. |
| `tests/test.py` | The verifier. |
| `solution/curate_labels.py` | The reference solution. It reads root spans and `review` annotations with the Phoenix client, takes each trace's latest human review, and creates the dataset with span links. `solution/solve.sh` runs it. |
