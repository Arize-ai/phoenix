# Evaluation workflow tasks

These Harbor tasks measure whether a coding agent can do the evaluation work a Phoenix
user does: build evals for an app, fix a misleading eval, improve a judge or a prompt,
decide whether to trust a judge, compare experiments, and turn reviews into a dataset.
Each task is a request a user might send a coding agent, run against a Phoenix server
that already holds that user's data.

The suite answers two questions:

- **Can the agent do the work?** `reward` is 1 when the deliverable is correct and 0
  otherwise. It grades only the deliverable. Loading a skill, or using a particular
  library or interface, earns nothing.
- **What do skills change?** The job runs each model with and without the Phoenix
  skills. Compare pass rates, and compare efficiency: turns, tool calls, cost, and time.
  Each run also reports how the agent worked, such as which skills it loaded, without
  counting it toward `reward`.

Read this page, the job file
[`jobs/eval-workflows.yaml`](../../jobs/eval-workflows.yaml), and each task's
`Task.md` to see everything the suite does.

## What the job runs

[`jobs/eval-workflows.yaml`](../../jobs/eval-workflows.yaml) runs four conditions on
every task, three attempts each, in Daytona sandboxes:

| Condition | Agent | Model | Skills |
| --- | --- | --- | --- |
| `claude-code-opus-no-skills` | Claude Code with the px CLI | Opus 5.5 | None |
| `claude-code-opus-skills` | Claude Code with the px CLI | Opus 5.5 | `phoenix-cli`, `phoenix-error-analysis`, `phoenix-evals`, `phoenix-tracing` from the repository's `skills/` |
| `claude-code-haiku-no-skills` | Claude Code with the px CLI | Haiku 5.5 | None |
| `claude-code-haiku-skills` | Claude Code with the px CLI | Haiku 5.5 | Same as above |

The skills conditions load whatever is in `skills/` in your checkout. To compare two
versions of the skills, see [Compare skill versions](#compare-skill-versions).

The Phoenix Harbor plugin records the job in your Phoenix as the `eval-workflows`
dataset, with one experiment per condition. Each run carries `reward`, every check, the
measures below, and the plugin's token counts, cost, and latency.

## Tasks

| Task | Workflow | The agent delivers |
| --- | --- | --- |
| [response-evals](response-evals/Task.md) | Build evals from an app's spec | One annotation per requirement on every trace, and a script that scores new traces |
| [session-evals](session-evals/Task.md) | Evaluate multi-turn conversations | Two annotations per session, and a script that scores new and continued sessions |
| [rag-evals](rag-evals/Task.md) | Separate retrieval failures from generation failures | Relevance on each retrieved document, groundedness on each answer, and a script that scores new traces |
| [repair-evals](repair-evals/Task.md) | Fix a misleading eval | A corrected nightly script, its rerun, and a reply that names the bugs and the real rate |
| [improve-judge](improve-judge/Task.md) | Improve an LLM judge against human reviews | A judge that agrees with reviewers on traces it never saw |
| [improve-app](improve-app/Task.md) | Improve an app's prompt with experiments | A new prompt version that follows the handbook on questions it never saw, and an experiment scored with the baseline's four evaluations |
| [judge-trust](judge-trust/Task.md) | Decide whether to trust a judge | A recommendation backed by the right metrics. Right answer: don't turn it on. |
| [judge-trust-ready](judge-trust-ready/Task.md) | Decide whether to trust a judge | A recommendation backed by the right metrics. Right answer: turn it on. |
| [compare-experiments](compare-experiments/Task.md) | Compare two experiments | A ship decision backed by pass rates across repeated runs. Right answer: don't ship. |
| [compare-experiments-ship](compare-experiments-ship/Task.md) | Compare two experiments | A ship decision backed by pass rates across repeated runs. Right answer: ship. |
| [curate-labels](curate-labels/Task.md) | Build a labeled dataset from reviews | A Phoenix dataset with exactly the eligible traces and their latest human labels |

The last four rows are two pairs of twins. Twins send the same request and seed data of
the same shape, but the data supports opposite answers. An agent that answers the same
way every time, such as always advising caution, fails one task in each pair.

## How a task runs

1. **Staging, on your machine.** `make harbor-stage` runs
   [`environments/fixtures/seed_phoenix.py`](../../environments/fixtures/seed_phoenix.py)
   on the task's `fixture/phoenix_seed.json`. The seeder starts a temporary Phoenix,
   writes the projects, spans, annotations, prompts, datasets, and experiments in the
   file, checks them, and saves the database. Staging copies that database and the
   task's `workdir/` into the task's build context. Tasks with identical seed files share
   one database.
2. **The agent's turn, in a sandbox.** The sandbox starts Phoenix on the seeded
   database. The agent gets `instruction.md`, a shell as the user `agent`, the files in
   `/app`, and network access to `api.anthropic.com` and `api.openai.com` only.
3. **Grading, in the same sandbox.** Harbor copies `tests/` in as root, so the agent
   never sees the answers. The verifier reads what the agent left in Phoenix, its files,
   and its final reply. For tasks that ask for a reusable script, it then adds traces the
   agent never saw, reruns the script, and grades the new annotations. It writes
   `reward.json` and a `details.json` that explains each check.

## How the data was made

Every task's data is synthetic. Each task's `fixture/build.py` generates its seed file
and its hidden answers (`tests/truth.json`) from hand-written templates. Generators that
sample use a fixed random seed, so rerunning any generator reproduces both files byte
for byte. The companies,
customers, orders, and policies are invented. No public dataset or user data is used.
The one exception is `improve-app`'s baseline experiment, which replays real
`gpt-5.4-mini` replies recorded once by `fixture/record_baseline.py`.

The data is built to look like a team's data where that matters for evaluation work:

- **Labels sit where people put them.** In `judge-trust`, reviewers switched tools
  partway through, so 50 labels are span annotations and 30 are trace annotations. The
  Python client can read span annotations but has no method for trace annotations, so
  the reference solution reads them with the REST route
  `GET /v1/projects/{project}/trace_annotations`.
- **Reviews get revised.** In `curate-labels`, reviewers revise their own reviews.
  Phoenix updates the annotation in place, so its `created_at` stays and its
  `updated_at` moves. The latest review is the one with the latest `updated_at`.
- **Experiments repeat.** In the comparison tasks, each experiment ran every example
  three times, and one run in each experiment errored.
- **Traffic keeps coming.** Script reruns add new traces in the last 6 hours, so a
  nightly script that scores the last day sees all of them. In `session-evals`, some new
  turns continue sessions the agent already scored.

Each label follows from a rule the generator applies, such as the refund the order
record allows or whether a tool result shows the action happened. Five kinds of checks
cover the data:

1. **The generators check their own output.** For example, `improve-judge` checks every
   label against the refund rule, and `compare-experiments` checks that each wrong way
   of reading the runs gives a wrong decision or a number outside the grader's
   tolerance.
2. **The seeder reads the data back.** It waits until every span is in Phoenix, and
   fails if any experiment run's output, evaluation, or repetition doesn't match the
   seed file.
3. **A second model reviewed the labels.** GPT-6 Astra read every task's data and labels
   on November 13, 2026. Each fix is listed in the task's `Task.md`. The review came
   before the traps added on November 14, such as the repeated runs, the trace-level
   labels, and the tracking timeouts, so no second model has reviewed those parts. No
   person has reviewed the labels.
4. **Reference and do-nothing agents bound the reward.** Each task's reference
   solution, which makes real model calls, scores 1, and an agent that does nothing
   scores 0.
5. **Naive approaches fail.** Each `Task.md` lists the shortcuts it's built to catch and
   what each one scores.

Each `Task.md` has a "How the data was made" section with the details for that task.

## How it's graded

`reward` is 1 when every check passes and 0 otherwise. Each check is also reported as 1
or 0 under the name in the task's `Task.md`:

- `production_*` checks grade the data that was in Phoenix when the agent started.
- `new_traces_*`, `new_sessions_*`, and `continued_sessions_*` checks grade what the
  agent's script wrote when the verifier reran it on data the agent never saw.
- `reply_*` checks and the decision checks grade the agent's final reply.

Some rules hold across tasks:

- **Annotations need recall on each class.** A check requires a minimum recall on good
  cases and on bad cases separately, so labeling everything one way fails.
- **Judges run on the cheapest model.** Tasks that ask for an LLM judge say the nightly
  job's API key can call only `gpt-5-nano`, and the rerun refuses any other model. On
  it, the reference prompts pass and naive prompts, such as raw span JSON with labels
  that aren't defined, fail.
- **Replies are graded on extracted claims.** An LLM reads the reply, without seeing the
  answers, and extracts the decision and each number with a quote. Code checks that the
  quote is in the reply and compares the value with the answer.
- **The verifier's own LLM calls use `gpt-6-luna`.**

## What a run reports

Besides `reward` and its checks, every run reports these measures. They never change
`reward`.

Every task reports how the agent worked:

| Key | Meaning |
| --- | --- |
| `turns` | The number of steps in the agent's trajectory. |
| `tool_calls` | The number of tool calls the agent made. |
| `loaded_<skill>` | 1 if the agent loaded that skill, such as `loaded_phoenix_evals`. `details.json` lists every skill loaded, in order. |

Five tasks ask the agent for an eval script that the verifier reruns: `response-evals`,
`session-evals`, `rag-evals`, `repair-evals`, and `improve-judge`. While the script
reruns, every model request it makes passes through a local proxy that records it
([`judge_prompts.py`](../../verifiers/harbor_verifiers/judge_prompts.py)). From those
requests, the verifier reports two measures of the judges the agent built:

| Key | Meaning |
| --- | --- |
| `uses_phoenix_evals` | The share of the script's judge requests that the phoenix-evals library sent. It shows whether the script uses the library. |
| `prompt_quality` | The share of judge requests whose prompt meets every item in the rubric below. An LLM scores one request from each of the four most-used prompt templates. |

| Rubric item | A good judge prompt |
| --- | --- |
| `one_criterion` | Judges exactly one criterion. |
| `needs_a_model` | Doesn't spend a model call on something code can check, such as JSON format. |
| `named_labels` | Asks for one label from a small named set, not a score or a Likert scale. |
| `app_context` | Says what the app is and what it should do, apart from the pasted trace data. |
| `readable_data` | Shows trace data as readable text, not raw span JSON or attribute keys. |
| `has_evidence` | Includes the evidence the criterion needs, such as retrieved documents or tool results. |
| `no_missing_reference` | Doesn't refer to a reference answer that isn't there. |
| `clear_structure` | Separates instructions, data, and question, and says what decides each label. |
| `no_copied_traces` | Doesn't quote the traces the agent saw. Code checks this one: a 10-word run that appears in the visible traces but not the new ones, in at least 20% of requests. |

`prompt_quality` is noisy: the same prompt can pass in one run and miss an item in the
next, so compare it across many runs, not one.

`improve-app` has no eval script. It reports `copies_dev_examples` instead: 1 if the
agent's saved prompt quotes one of the dataset's questions or names one of its order
numbers, a sign the prompt was tuned to the dataset rather than the handbook.

## Run the suite

You need `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `DAYTONA_API_KEY`, or Docker in place
of Daytona. See [the Harbor README](../../README.md#prerequisites) for setup.

To stage the tasks and run the full job, run these commands from the repository root:

```bash
HARBOR_TASKS_DIR=$PWD/evals/harbor/tasks/eval-workflows make harbor-stage
make harbor-run HARBOR_JOB=evals/harbor/jobs/eval-workflows.yaml
```

Restage after you change a seed file, `workdir/`, the verifiers, or the environment.
`HARBOR_ARGS` passes options to `harbor run`:

| To | Add |
| --- | --- |
| Run in local Docker instead of Daytona | `HARBOR_ARGS='-e docker'` |
| Run one attempt per task | `HARBOR_ARGS='-k 1'` |
| Run some tasks | `HARBOR_ARGS='-p evals/harbor/tasks/eval-workflows -i session-evals -i rag-evals'` |
| Name the job | `HARBOR_ARGS='--job-name skills-v2'` |
| Skip recording in Phoenix | `HARBOR_PLUGIN=` |

To run some conditions, write a reduced job file with
[`subset_job.py`](../../scripts/subset_job.py) and pass it as `HARBOR_JOB`. Don't use
`-a <agent>` for this, because it drops the condition's skills:

```bash
uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/eval-workflows.yaml \
  --agents claude-code-haiku-no-skills claude-code-haiku-skills --out evals/harbor/.cache/haiku.yaml
make harbor-run HARBOR_JOB=evals/harbor/.cache/haiku.yaml
```

### Check the tasks themselves

Run the reference solutions and a do-nothing agent after you change a task, a seed file,
or the verifiers. Every task should score 1 with the reference and 0 with nothing.
These runs need no px archive:

```bash
HARBOR_CLI=0 HARBOR_TASKS_DIR=$PWD/evals/harbor/tasks/eval-workflows make harbor-stage
make harbor-run HARBOR_JOB=evals/harbor/jobs/eval-workflows.yaml HARBOR_PLUGIN= HARBOR_ARGS='-a oracle -p evals/harbor/tasks/eval-workflows'
make harbor-run HARBOR_JOB=evals/harbor/jobs/eval-workflows.yaml HARBOR_PLUGIN= HARBOR_ARGS='-a nop -p evals/harbor/tasks/eval-workflows'
```

### Compare skill versions

To run the skills as they were at another commit, extract them to
`evals/harbor/.cache/skills-<name>/skills` with
[`agents/snapshot_skills.sh`](../../agents/snapshot_skills.sh):

```bash
evals/harbor/agents/snapshot_skills.sh main baseline
```

Then add a condition to a copy of the job file whose `skills` paths start with
`evals/harbor/.cache/skills-baseline/skills/`, and run it next to the condition that
loads your working copy.

### Add an agent or a model

Add an entry under `agents:` in a copy of the job file. The Harbor README describes the
[available agents](../../README.md#benchmark-conditions).

## Change a task

Each task directory has the same layout:

| Path | Purpose |
| --- | --- |
| `Task.md` | The page a reviewer reads: the request, the starting data, how the data was made, how it's graded, and what it tests. |
| `instruction.md` | The request the agent receives. `Task.md` quotes it word for word. |
| `task.toml` | Harbor configuration. `fixture = "phoenix-seed"` tells staging to seed Phoenix from `fixture/phoenix_seed.json`. |
| `fixture/build.py` | The generator for `fixture/phoenix_seed.json` and `tests/truth.json`. |
| `fixture/phoenix_seed.json` | The Phoenix state the agent starts with. Generated. |
| `workdir/` | Files copied to `/app`, such as the app's code or the team's eval script. |
| `tests/` | The verifier, `tests/test.sh` and `tests/test.py`, with its hidden answers in `truth.json`. |
| `solution/` | A reference solution that does the work for real, including model calls. |

To change a task's data, edit its `fixture/build.py` and run it from the repository root:

```bash
uv run python evals/harbor/tasks/eval-workflows/session-evals/fixture/build.py
```

[`.gitattributes`](.gitattributes) marks the generated JSON files so GitHub collapses
them in pull request diffs. Review `fixture/build.py` instead.

To check a task's verifier in about a minute, without building an image, run
[`check_task_locally.py`](../../environments/fixtures/check_task_locally.py). It seeds a
temporary Phoenix from the task's seed file, runs the task in a local process, and
prints the reward. By default it does nothing before grading, so the reward must be 0.
`--solution` runs the reference solution first, so the reward must be 1. `--evals DIR`
copies someone's eval code into `/app/evals` first, which is how you replay an agent's
saved script against a changed task. A Harbor run is still the real check.

```bash
uv run python evals/harbor/environments/fixtures/check_task_locally.py session-evals
uv run python evals/harbor/environments/fixtures/check_task_locally.py session-evals --solution
```

The shared code is in these files:

| File | Contents |
| --- | --- |
| [`environments/fixtures/seed_phoenix.py`](../../environments/fixtures/seed_phoenix.py) | The seeder, and the format of a seed file. |
| [`environments/fixtures/support_traces.py`](../../environments/fixtures/support_traces.py) | Span builders the generators use. |
| [`verifiers/harbor_verifiers/grading.py`](../../verifiers/harbor_verifiers/grading.py) | Grading shared across tasks: recall checks, reply claims, and reruns. |
| [`verifiers/harbor_verifiers/judge_prompts.py`](../../verifiers/harbor_verifiers/judge_prompts.py) | The recording proxy, `uses_phoenix_evals`, and `prompt_quality`. |

Unit tests for the shared code run offline:

```bash
uv run --all-packages pytest tests/unit/harbor/eval_workflows
```
