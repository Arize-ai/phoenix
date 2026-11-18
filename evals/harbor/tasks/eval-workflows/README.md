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
| `claude-code-opus-no-skills` | Claude Code with the px CLI | Claude Opus 5.5 | None |
| `claude-code-opus-skills` | Claude Code with the px CLI | Claude Opus 5.5 | `phoenix-cli`, `phoenix-error-analysis`, `phoenix-evals`, `phoenix-tracing` from the repository's `skills/` |
| `codex-sol-no-skills` | Codex with the px CLI | `gpt-6.2-sol` | None |
| `codex-sol-skills` | Codex with the px CLI | `gpt-6.2-sol` | Same as above |

The skills conditions load whatever is in `skills/` in your checkout. To compare two
versions of the skills, see [Compare skill versions](#compare-skill-versions).

The Phoenix Harbor plugin records the job in your Phoenix as the `eval-workflows`
dataset, with one experiment per condition. Each task's `tests/expected.json` becomes its
example's expected output, so you can read the right answer beside each run.

## Tasks

| Task | Workflow | The agent delivers |
| --- | --- | --- |
| [response-evals](response-evals/Task.md) | Build evals from an app's spec | One annotation per requirement on every trace, and a script that scores new traces |
| [session-evals](session-evals/Task.md) | Evaluate multi-turn conversations | Two annotations per session, and a script that scores new and continued sessions |
| [rag-evals](rag-evals/Task.md) | Separate retrieval failures from generation failures | Relevance on each retrieved document, groundedness on each answer, and a script that scores new traces |
| [repair-evals](repair-evals/Task.md) | Fix a misleading eval | A corrected nightly script, its rerun, and a reply that names the bugs and the real rate |
| [improve-judge](improve-judge/Task.md) | Improve an LLM judge against human reviews | A judge that agrees with reviewers on traces it never saw |
| [improve-app](improve-app/Task.md) | Improve an app's prompt with experiments | A new prompt version that follows the handbook on questions it never saw, and an experiment scored with the baseline's four evaluations |
| [judge-trust](judge-trust/Task.md) | Decide whether to trust a judge | A recommendation backed by the judge's recall and false-alarm rate against reviewer labels. Right answer: don't turn it on. |
| [compare-experiments](compare-experiments/Task.md) | Compare two experiments | A ship decision backed by pass rates across repeated runs. Right answer: don't ship. |
| [compare-experiments-ship](compare-experiments-ship/Task.md) | Compare two experiments | A ship decision backed by pass rates across repeated runs. Right answer: ship. |
| [curate-labels](curate-labels/Task.md) | Build a labeled dataset from reviews | A Phoenix dataset with exactly the eligible traces and their latest human labels |

The two `compare-experiments` tasks are twins. They send the same request and seed data
of the same shape, but the data supports opposite answers, so an agent that always
advises caution fails one of them.

## How a task runs

1. **Staging, once, on your machine.** Before you run the job, `make harbor-stage`
   prepares every task. For each task it runs
   [`environments/fixtures/seed_phoenix.py`](../../environments/fixtures/seed_phoenix.py)
   on the task's committed `fixture/phoenix_seed.json`. The seeder starts a temporary
   Phoenix, writes the projects, spans, annotations, prompts, datasets, and experiments
   in the file through Phoenix's API, checks them, and saves the database. It caches the
   database by the seed file's hash, so it reseeds only files that changed. Staging then
   writes each task's build context to its `environment/` directory: the shared
   Dockerfile, the Phoenix and verifier wheels, the database, and the task's `workdir/`.
2. **The agent's turn, in a sandbox.** Harbor builds each task's sandbox from its
   `environment/` directory. The sandbox starts Phoenix on the seeded database. The agent gets `instruction.md`, a shell as the user `agent`, the files in
   `/app`, and network access to `api.anthropic.com` and `api.openai.com` only.
3. **Grading, in the same sandbox.** Harbor copies `tests/` in as root, so the agent
   never sees the answers. The verifier reads what the agent left in Phoenix, its files,
   and its final reply. For tasks that ask for a reusable script, it then adds traces the
   agent never saw, reruns the script, and grades the new annotations. It writes
   `reward.json` and a `details.json` that explains each check.

## How the data was made

Every task's data is synthetic and committed to the repository. Each task has a
generator, `fixture/build.py`, a Python script that writes two things:

- `fixture/phoenix_seed.json`: the Phoenix state the agent starts with.
- The hidden answers in `tests/`: `expected.json`, and for most tasks
  `grading_data.json`, which holds per-trace labels and the traces the verifier adds
  during grading.

The generator's content is written out by hand in the script: the companies, customers,
orders, and policies, and templates for questions, replies, and reviewer notes. No model
generates data when a generator runs. Most generators use a fixed random seed to fill
the templates: it picks names, order numbers, products, and dates, decides which
template and which wrong claim a reply gets, shuffles the order of cases, and adds
jitter to timestamps and scores. Labels don't come from the random draw. Each one follows
from a rule the generator applies to the facts it picked, such as the refund an order
record allows or whether a tool result shows the action happened. With a fixed seed,
rerunning a generator reproduces its files byte for byte.

When a task runs, nothing is regenerated. Staging seeds Phoenix from the committed seed
file, and the verifier reads the committed answers. The verifier moves the timestamps of
the traces it adds into the last 6 hours before it writes them. Only model output is new
on each run: the agent's work, the judges' verdicts, and, in `improve-app`, the app's
replies to the hidden questions. `improve-app`'s baseline experiment is the one recorded
exception: it replays real `gpt-5.4-mini` replies that `fixture/record_baseline.py`
recorded once. No public dataset or user data is used.

This differs from the TRAIL and error-analysis suites, which seed one shared database
for all of their tasks: TRAIL from a gated Hugging Face dataset of real agent traces, and
error-analysis from a published database download. Each task here needs its own small
state with known answers, so each one carries a generator and a seed file that you can
review in a diff.

The data is built to look like a team's data where that matters for evaluation work:

- **Labels sit where people put them.** In `judge-trust`, reviewers switched tools
  partway through, so some labels are span annotations and the rest are trace
  annotations. The Python client reads span annotations
  (`spans.get_span_annotations`), but its `traces` resource only writes trace
  annotations, so the reference solution reads them with the REST route
  `GET /v1/projects/{project}/trace_annotations`. `px trace list
  --include-annotations` also returns them.
- **Reviews get revised.** In `curate-labels`, reviewers revise their own reviews.
  Phoenix updates the annotation in place, so its `created_at` stays and its
  `updated_at` moves. The latest review is the one with the latest `updated_at`.
- **Experiments repeat.** In the comparison tasks, each experiment ran every example
  three times, and one run in each experiment errored.
- **Traffic keeps coming.** Script reruns add new traces in the last 6 hours, so a
  nightly script that scores the last day sees all of them. In `session-evals`, some new
  turns continue sessions the agent already scored.

Five kinds of checks cover the data:

1. **The generators check their own output.** Each `build.py` ends with Python
   assertions that run every time it writes its files; no model is involved. For
   example, `improve-judge` checks every label against the refund rule, and
   `compare-experiments` checks that each wrong way of reading the runs gives a wrong
   decision or a number outside the grader's tolerance.
2. **The seeder reads the data back.** It waits until every span is in Phoenix, and
   fails if any experiment run's output, evaluation, or repetition doesn't match the
   seed file.
3. **A second model checked the answers.** GPT-6 Astra read every task's data and labels
   and checked them against the task's rules. No person has reviewed the labels.
4. **Reference and do-nothing agents bound the reward.** Each task's reference
   solution, which makes real model calls, scores 1, and an agent that does nothing
   scores 0.
5. **Wrong approaches fail.** Each `Task.md` lists the realistic mistakes the task is
   built to catch and the check each one fails.

## How it's graded

Each task defines its own pass criteria, one check per requirement in the user's
request, and its `Task.md` lists them. Each check is reported as 1 or 0. `reward` is 1
only when every one of the task's checks passes. Each run also reports measures that
never affect `reward`; see [What a run reports](#what-a-run-reports).

Check names follow one pattern across tasks:

| Check | What it grades |
| --- | --- |
| `production_traces`, `production_sessions` | The agent's annotations on the data that was in Phoenix when it started. |
| `new_traces`, `new_sessions`, `continued_sessions` | What the agent's script writes when the verifier reruns it on data the agent never saw. |
| `decision`, `numbers` | The call and the numbers in the agent's final reply. |
| `reply` | Whether the final reply tells the user what they asked about. |

Other checks are specific to one task, and its `Task.md` explains them.

Some rules hold across tasks:

- **Annotations need recall on each class.** A check requires a minimum recall on good
  cases and on bad cases separately, so labeling everything one way fails.
- **Judges run on a small model.** Tasks that ask for an LLM judge ask for
  `gpt-5-nano`, and the rerun refuses any other chat model. On it, the reference prompts pass
  and naive prompts, such as raw span JSON with labels that aren't defined, fail.
- **Replies are graded on extracted claims.** An LLM reads the reply, without seeing the
  answers, and extracts the decision and each number with a quote. Code checks that the
  quote is in the reply and compares the value with the answer.
- **The verifier's LLM calls use `gpt-6-luna`.** That covers its LLM judges, such as
  the ones that grade `improve-app`'s replies, and the step that extracts claims from a
  reply.

## What a run reports

Besides `reward` and its checks, every run reports these measures. They never change
`reward`.

Every task reports how the agent worked:

| Key | Meaning |
| --- | --- |
| `turn_count` | The number of steps in the agent's trajectory. |
| `tool_count` | The number of tool calls the agent made. |
| `loaded_<skill>` | 1 if the agent loaded that skill, such as `loaded_phoenix_evals`. `details.json` lists every skill loaded, in order. |

Five tasks ask the agent for an eval script that the verifier reruns: `response-evals`,
`session-evals`, `rag-evals`, `repair-evals`, and `improve-judge`. During the rerun, the
verifier points the script's OpenAI and Anthropic clients at a proxy inside the sandbox
([`judge_prompts.py`](../../verifiers/harbor_verifiers/judge_prompts.py)). The proxy
forwards each request and does two things with it:

- It refuses any model other than `gpt-5-nano` with a 403 error, the way a key scoped to
  that model would. Embedding requests pass, so a script can still pick examples by
  similarity.
- It records the request, so the verifier can see the judge prompts the script sends.

From the recorded requests, the verifier reports two measures of the judges the agent
built:

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

`improve-app` has no eval script. It reports `no_overfit` instead: 0 if the agent's
saved prompt quotes 10 or more words in a row from one of the dataset's questions or
names one of its order or customer IDs, a sign the prompt was tuned to the dataset
rather than the handbook, and 1 otherwise.

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

The plugin records to the Phoenix at `PHOENIX_COLLECTOR_ENDPOINT`, with
`PHOENIX_API_KEY` if that Phoenix needs one. Without them, it uses a local Phoenix on
the default port. To record to another Phoenix, such as a shared team instance, set both
variables for the run, or pass
`HARBOR_ARGS='--plugin-kwarg endpoint=https://phoenix.example.com'`.

To run some conditions, write a reduced job file with
[`subset_job.py`](../../scripts/subset_job.py) and pass it as `HARBOR_JOB`. Don't use
`-a <agent>` for this, because it drops the condition's skills:

```bash
uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/eval-workflows.yaml \
  --agents codex-sol-no-skills codex-sol-skills --out evals/harbor/.cache/codex.yaml
make harbor-run HARBOR_JOB=evals/harbor/.cache/codex.yaml
```

### Check the tasks themselves

Run the reference solutions (Harbor's `oracle` agent) and Harbor's do-nothing `nop`
agent after you change a task, a seed file, or the verifiers. Every task should score 1
with `oracle` and 0 with `nop`. These runs need no px archive:

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
| `task.toml` | Harbor configuration. `fixture = "phoenix-seed"` tells staging to seed Phoenix from `fixture/phoenix_seed.json`, and `reference_output_path` tells the Phoenix plugin to record `tests/expected.json` as the expected output. |
| `fixture/build.py` | The generator for `fixture/phoenix_seed.json` and the hidden answers in `tests/`. |
| `fixture/phoenix_seed.json` | The Phoenix state the agent starts with. Generated. |
| `workdir/` | Files copied to `/app`, such as the app's code or the team's eval script. |
| `tests/` | The verifier, `tests/test.sh` and `tests/test.py`. Its hidden answers are `expected.json`, the expected outcome, and `grading_data.json`, the labels and added traces it grades against. |
| `solution/` | A reference solution that does the work for real, including model calls. |

To change a task's data, edit its `fixture/build.py` and run it from the repository root:

```bash
uv run python evals/harbor/tasks/eval-workflows/session-evals/fixture/build.py
```

[`.gitattributes`](.gitattributes) marks the generated JSON files so GitHub collapses
them in pull request diffs. Review `fixture/build.py` instead.

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
