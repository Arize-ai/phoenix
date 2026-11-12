# curate-labels

Turn human reviews in Phoenix into a labeled dataset for checking a grounding judge.
Workflow: **build a labeled dataset from reviews**.

## The request

The agent receives `instruction.md` verbatim:

> Our reviewers have been checking support-bot replies in Phoenix, and their verdicts are the `review` annotations on the `support-bot-reviews` project.
>
> Can you turn them into a dataset called `grounding-golden` that we can use to test our grounding judge? Each trace you keep becomes one example, with the customer's question and the bot's reply as input, the verdict (`supported` or `unsupported`) as the expected output, and a link back to its source span. Go by each trace's most recent human review, and skip traces where that review is still `needs_review` and traces that only have the auto-labeler's pre-label.
>
> Tell me how many examples you included and what you left out.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `support-bot-reviews` | 90 traces of a SaaS support bot. Root `support-bot` span (input: the customer's question; output: the bot's reply). Children: `get_workspace` tool (plan and workspace record), `search_help_center` retriever (the relevant help article and 2 others), and the LLM call. |
| `review` span annotations on root spans | Human reviews (`HUMAN`, identifiers `alice`, `bob`, `carmen`, `dmitri`) labeled `supported`, `unsupported`, or `needs_review`, each with a short note. Pre-labels from the auto-labeler (`LLM`, identifier `prelabel-bot`) labeled `supported` or `unsupported`. |
| Other annotations | `user_feedback` (`HUMAN`, thumbs up or down) on most root spans, and nightly `helpfulness`, `tone`, `tool_ok`, and `retrieval_hit` evals on child spans. None of them are reviews. |

Phoenix keeps one annotation per name, span, and identifier, so a trace with two human
reviews has them from two different reviewers. Every review history is built on
purpose:

| Review history | Traces | In the dataset |
| --- | --- | --- |
| One human verdict | 23 | Yes |
| Two humans agree | 3 | Yes |
| Two humans disagree; the later one is right | 6 | Yes, with the later verdict |
| `needs_review`, then a later human verdict | 4 | Yes |
| Pre-label disagrees, written before the human verdict | 4 | Yes, with the human verdict |
| Pre-label disagrees, written after the human verdict | 4 | Yes, with the human verdict |
| Pre-label agrees with the human verdict | 4 | Yes |
| Two pairs of traces with identical question and reply text | 4 | Yes, all four |
| Human verdict, then a later `needs_review` | 4 | No |
| Only `needs_review` | 3 | No |
| Only a pre-label | 13 | No |
| Pre-label and a human `needs_review` | 3 | No |
| No review | 15 | No |

That leaves 52 eligible traces: 27 `supported` and 25 `unsupported`. Each eligible
trace's latest human verdict is correct by construction. A `supported` reply restates
only the help article and the workspace record. An `unsupported` reply adds or
contradicts a fact.

## How it's graded

`reward` is 1 only when every check passes. The verifier reads the latest version of
`grounding-golden` through `GET /v1/datasets/{id}/examples`. An example links to a
trace through Phoenix's span link (the example's `source.span_id`, which
`create_dataset` sets from `span_id_key` or an example's `span_id`), or through a
metadata field whose name ends in `span_id` or `trace_id`. A link to any span in the
trace counts.

| Check | Passes when |
| --- | --- |
| `linked` | Every example links to exactly one trace in the project. |
| `traces` | The linked traces are exactly the 52 eligible traces, each once. |
| `labels` | Every example's output states its trace's latest human verdict: the word `supported` or `unsupported` anywhere in the output, or a boolean under a key containing `support` or `ground`, such as `{"supported": true}`. An output that states both verdicts fails. |
| `inputs` | Every example's input contains the question and the reply text, ignoring case and whitespace. |
| `no_label_in_input` | No input contains `supported`, `unsupported`, or `needs_review`, a key such as `label`, `verdict`, or `review`, or any review note on that trace. |

The verifier doesn't grade the final reply.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Taking the first human review, or letting the oldest win because the API lists annotations newest first | Two humans disagree, and `needs_review` comes before or after a verdict. |
| Taking the latest review of any kind | Pre-labels written after the human verdict disagree with it, and pre-label-only traces become extra examples. |
| Falling back to the pre-label when no human verdict exists | Pre-label-only traces and pre-label plus `needs_review` traces. |
| Skipping a `needs_review` and using the verdict before it | A human verdict followed by a later `needs_review`. |
| Deduplicating by text | Two pairs of distinct traces share the question and reply text. |
| Grabbing every human annotation | `user_feedback` annotations are human but aren't reviews. |
| Copying the verdict or note into the input | The leak check on inputs. |

Verified controls, run locally against the seeded fixture:

| Control | Reward | Failing checks |
| --- | --- | --- |
| No dataset (nop) | 0 | All |
| Reference solution | 1 | None |
| Native span link only, metadata `trace_id` only, `span_id_key` on a DataFrame, `{"supported": true}` output | 1 | None |
| First human review | 0 | `traces`, `labels` |
| Annotations in API order, last one wins | 0 | `traces`, `labels` |
| Latest review of any kind | 0 | `traces`, `labels` |
| Latest human review that isn't `needs_review` | 0 | `traces` |
| Human verdict, else the pre-label | 0 | `traces` |
| Deduplicate by question and reply | 0 | `traces` |
| Latest human annotation of any name | 0 | `traces` |
| Verdict copied into the input | 0 | `no_label_in_input` |
| No link | 0 | All |

## Known limits

- Phoenix stores annotation timestamps to the second in SQLite. The seeder writes about
  430 other annotations between the first and second rounds of human reviews, which
  keeps each trace's two reviews in different seconds when seeding runs at a few
  hundred writes per second. A much faster seed could give two reviews the same
  `created_at`. The annotation's row ID still orders them.
- The task needs no judgment, so the reference solution makes no model calls. It tests
  careful data handling, not grading skill.
- The reply's counts aren't graded; the dataset is the deliverable.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (traces and annotations in write order) and `tests/truth.json` (eligible traces, verdicts, texts, and notes). Rerun it after editing; it's deterministic. |
| `tests/test.py` | The verifier. |
| `solution/curate_labels.py` | Reference solution: reads root spans and `review` annotations with the Phoenix client, takes each trace's latest human review, and creates the dataset with span links. `solution/solve.sh` runs it. |
