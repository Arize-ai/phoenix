# Phoenix evals tasks

These Harbor tasks measure whether a coding agent can do real evaluation work with
Phoenix, and whether the `phoenix-evals` skill helps. Each task is a request a Phoenix
user might send a coding agent, run against a Phoenix server seeded with that user's
data. `reward` is 1 when the deliverable is correct and 0 otherwise.

Start with a task's `Task.md`: it shows the request, what the agent starts with, how
the deliverable is graded, and which mistakes the task is built to catch.

| Task | Workflow | Deliverable |
| --- | --- | --- |
| [response-evals](response-evals/Task.md) | Build evals for an app spec | One annotation per requirement on every trace, and a rerunnable script |
| [session-evals](session-evals/Task.md) | Evaluate multi-turn conversations | Two annotations per session, and a rerunnable script |
| [rag-evals](rag-evals/Task.md) | Separate retrieval and generation failures | Relevance on each retrieved document, groundedness on each answer, and a rerunnable script |
| [repair-evals](repair-evals/Task.md) | Fix a misleading eval | A corrected nightly script and its rerun |
| [improve-judge](improve-judge/Task.md) | Improve an LLM judge | A judge that agrees with reviewers on traces it never saw |
| [improve-app](improve-app/Task.md) | Improve an app's prompt with experiments | A new prompt version that follows the handbook on questions it never saw |
| [judge-trust](judge-trust/Task.md), [judge-trust-ready](judge-trust-ready/Task.md) | Decide whether to trust a judge | A recommendation backed by the right metrics |
| [compare-experiments](compare-experiments/Task.md), [compare-experiments-ship](compare-experiments-ship/Task.md) | Compare two experiments | A ship decision backed by the right numbers |
| [curate-labels](curate-labels/Task.md) | Build a labeled dataset from reviews | A Phoenix dataset with exactly the eligible traces and their labels |

Paired tasks (`judge-trust` and `judge-trust-ready`, and the two comparisons) have the
same request but opposite correct answers, so a fixed answer can't pass both.

## How the tasks work

- **Data lives in Phoenix.** `fixture/build.py` generates `fixture/spec.json`, which
  [`seed_spec.py`](../../environments/fixtures/seed_spec.py) loads into the task's
  Phoenix database during staging. Fixtures are synthetic and built so every label is
  correct by construction.
- **Hidden truth lives in `tests/`.** Harbor copies `tests/` into the container only
  for the verifier, as root. The agent never sees labels for graded cases.
- **The request names the deliverable.** The instruction names the annotation,
  dataset, or script the user expects, the way a team would. The verifier grades that
  deliverable and never searches for whatever agrees best with the answers.
- **Reusable work is rerun on unseen data.** For tasks that ask for an eval script,
  the verifier adds new traces the agent never saw, runs the script as the agent user,
  and grades the new annotations. For `improve-app`, it runs the app with the agent's
  final prompt on new questions. A one-off or overfit result fails.
- **Recall is checked per class.** Annotation checks require a minimum recall on good
  and on bad cases separately, so a constant label fails.
- **Replies are graded on extracted claims.** For analysis tasks, an LLM extracts the
  stated decision and numbers with verbatim quotes, without seeing the answers. Code
  compares them with the expected values.

## Practice measures

`reward` grades only the deliverable. Tasks whose verifier reruns an eval script also
report how the script's LLM judges were built, as 0-to-1 `practice_*` scores beside
`reward`. They never change `reward`. Harbor averages each one across trials, so you
can compare agents and skill versions on them.

During the rerun, the verifier points `OPENAI_BASE_URL` and `ANTHROPIC_BASE_URL` at a
local recorder that forwards each request and keeps a copy
([`judge_practice.py`](../../verifiers/harbor_verifiers/judge_practice.py)).

| Score | What it measures | How |
| --- | --- | --- |
| `practice_phoenix_evals` | Share of judge requests sent by phoenix-evals | Its evaluators request a result named `extract_structured_data`. |
| `practice_no_copied_examples` | Share of requests whose prompt template doesn't quote traces the agent saw | A 10-word run of text found in the visible traces but not the new ones, repeated across at least 20% of requests so it's template text rather than the trace being judged. `improve-app` checks its saved prompt against the development questions instead. |
| `practice_one_criterion` | Share of requests that judge exactly one criterion | LLM rubric |
| `practice_code_for_deterministic` | Share of requests that don't spend a model call on a criterion code can check, such as JSON format | LLM rubric |
| `practice_discrete_labels` | Asks for a named label, not a score or Likert scale | LLM rubric |
| `practice_system_context` | Says what the app is and what it should do | LLM rubric |
| `practice_readable_data` | Presents trace data as readable text, not raw span JSON | LLM rubric |
| `practice_relevant_fields` | Includes the evidence each criterion needs, such as documents or tool results | LLM rubric |
| `practice_no_assumed_reference` | Doesn't refer to a reference answer that doesn't exist | LLM rubric |
| `practice_clear_structure` | Separates instructions, data, and question, and defines each label | LLM rubric |
| `practice` | The mean of the scores above | |

The rubric grades one request from each of the four most-used prompt templates and
weights each by how many requests used it. Details, including the grader's notes, are
in `details.json` under `practice`.

Shared grading code is in
[`harbor_verifiers/grading.py`](../../verifiers/harbor_verifiers/grading.py). Span
builders for fixtures are in
[`support_traces.py`](../../environments/fixtures/support_traces.py).

## Task layout

| Path | Purpose |
| --- | --- |
| `Task.md` | The single page a reviewer reads. Quotes `instruction.md` verbatim. |
| `instruction.md` | The request the agent receives. |
| `task.toml` | Harbor config. `fixture = "spec"` seeds Phoenix from `fixture/spec.json`. |
| `fixture/build.py` | Deterministic generator for `fixture/spec.json` and `tests/truth.json`. |
| `workdir/` | Files copied to `/app`, such as app code and an existing eval script. |
| `tests/test.py`, `tests/test.sh` | The verifier and its hidden data. |
| `solution/` | A reference solution that does the work for real, including LLM calls. |

## Check a task

Run the verifier against a local Phoenix, without Docker. Without `--solution` it's
the nop control and must score 0:

```bash
uv run python evals/harbor/scripts/check_task_locally.py response-evals
proj keys --env llm -- uv run python evals/harbor/scripts/check_task_locally.py response-evals --solution
```

Then stage and run the oracle and nop agents in Docker:

```bash
HARBOR_CLI=0 HARBOR_TASKS_DIR=$PWD/evals/harbor/tasks/phoenix-evals make harbor-stage
proj keys --env llm -- env -u ANTHROPIC_BASE_URL make harbor-run HARBOR_JOB=evals/harbor/jobs/phoenix-evals.yaml HARBOR_PLUGIN= HARBOR_ARGS='-e docker -a oracle -p evals/harbor/tasks/phoenix-evals --job-name phoenix-evals-oracle'
```

Unit tests for the shared grading code run offline:

```bash
uv run --all-packages pytest tests/unit/harbor/phoenix_evals
```
