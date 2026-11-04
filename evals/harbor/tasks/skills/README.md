# Skill tasks

Each task here checks whether an agent with a public skill finishes a realistic Phoenix
task. The task metadata is defined in [Skill eval case formats](../../../skills/README.md).

## Write a Harbor task

These rules apply to any Harbor task whose reward comes from what the agent did.

- **Grade the outcome, not the reply.** The verifier inspects the state the agent left
  behind or runs the code the agent wrote. It doesn't read the agent's prose.
- **Compute the expected result at verification time.** Derive it from the environment
  instead of storing a literal answer, so the task keeps working when the fixture changes.
- **Ask for structured answers.** When the task is a question, have the agent write a file
  with named fields, and check each field on its own.
- **Run the agent's code yourself.** Start any service the code needs, run the code with a
  timeout, and check what it printed or changed.
- **Pass the reference solution, fail the do-nothing agent.** `solution/solve.sh` must
  score 1 under `-a oracle`, and the task must score 0 under `-a nop`. A task that passes
  under `nop` has a verifier that accepts anything.
- **Use an LLM judge last.** Use one only when code can't decide the result.

## Phoenix tasks in this repository

Tasks live in `SKILL_NAME/TASK_NAME/`. Most use the `sample-app` fixture in
`environments/fixtures/sample-app/`, which puts a small support bot in `/app` and seeds
Phoenix with its traces. The fixture's README lists what it seeds. Verifiers query Phoenix
at `http://127.0.0.1:6006` with `harbor_verifiers.phoenix_api` and record the reward with
`harbor_verifiers.verify.write_reward`.

### Start from a template

Copy the template that matches the task's shape from `_templates/` into
`SKILL_NAME/TASK_NAME/`. Then change `instruction.md`, the `[task]` and `[metadata]`
tables in `task.toml`, the solution, and the checks. Rename `tests/TEMPLATE_checks.py` to
`tests/TASK_NAME_checks.py`, with underscores, and update `tests/test.sh` to match.
Mypy type-checks every verifier and rejects two modules with the same name.

| Template | The agent | The verifier |
| --- | --- | --- |
| `trace-questions` | Reads seeded traces and writes `/app/answer.json` | Computes the answer from Phoenix and compares each field |
| `instrument-app` | Adds tracing to the support bot | Runs the bot and checks the spans that reach Phoenix |
| `build-eval` | Runs an evaluator over a dataset as a Phoenix experiment | Checks the experiment's runs and scores against the outputs |
| `fix-code` | Fixes a broken Phoenix script given in the instruction | Runs the fixed script and compares its output with Phoenix |

### Check a task

Stage the tasks, then run the reference solutions and the do-nothing agent. Neither run
calls a model:

```bash
make harbor-stage HARBOR_CLI=0
make harbor-run HARBOR_JOB=evals/harbor/jobs/skills-templates.yaml HARBOR_ARGS='-a oracle -e docker' HARBOR_PLUGIN=
make harbor-run HARBOR_JOB=evals/harbor/jobs/skills-templates.yaml HARBOR_ARGS='-a nop -e docker' HARBOR_PLUGIN=
```

To check one skill's tasks, copy the job file and change its dataset path.
