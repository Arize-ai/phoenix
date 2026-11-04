# Skill tasks

Each task here checks whether an agent with a public skill finishes a realistic Phoenix
task. Tasks live in `SKILL_NAME/TASK_NAME/`. Their metadata and the rules for their
verifiers are in [Skill eval case formats](../../../skills/README.md).

Most tasks use the `sample-app` fixture in
`environments/fixtures/sample-app/`: a small support bot in `/app` and a Phoenix database
with its traces. See that fixture's README for what it seeds.

## Start a task from a template

Copy the template that matches the task's shape into `SKILL_NAME/TASK_NAME/`, then change
`instruction.md`, the `[task]` and `[metadata]` tables in `task.toml`, the solution, and
the checks in `tests/TEMPLATE_checks.py`. Rename that file to `TASK_NAME_checks.py`, with
underscores, and update `tests/test.sh` to match. Mypy type-checks every verifier and
rejects two modules with the same name.

| Template | The agent | The verifier |
| --- | --- | --- |
| `trace-questions` | Reads seeded traces and writes `/app/answer.json` with named fields | Computes the answer from Phoenix and compares each field |
| `instrument-app` | Adds tracing to the support bot | Runs the bot and checks the spans that reach Phoenix |
| `build-eval` | Runs an evaluator over a dataset as a Phoenix experiment | Reads the experiment's runs and scores and checks them against the outputs |
| `fix-code` | Fixes a broken Phoenix script given in the instruction | Runs the fixed script and compares its output with Phoenix |

Each template is a working task about the sample app. Its reference solution passes, and
an agent that does nothing fails.

Write each verifier so that it computes the expected result from Phoenix or from what
the agent wrote, not from a stored answer. The tasks then keep working when the fixture
changes.

## Check a task

Stage the tasks, then run the reference solutions and an agent that does nothing. Both
runs make no model calls:

```bash
make harbor-stage HARBOR_CLI=0
make harbor-run HARBOR_JOB=evals/harbor/jobs/skills-templates.yaml HARBOR_ARGS='-a oracle -e docker' HARBOR_PLUGIN=
make harbor-run HARBOR_JOB=evals/harbor/jobs/skills-templates.yaml HARBOR_ARGS='-a nop -e docker' HARBOR_PLUGIN=
```

Every task must score 1 under `-a oracle` and 0 under `-a nop`. To check one skill's
tasks, copy the job file and change its dataset path.
