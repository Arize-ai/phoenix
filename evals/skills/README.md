# Skill eval case formats

This page fixes the file formats for the cases that test the public skills in `skills/`.
Two kinds of case exist:

| Case | Question | Location |
| --- | --- | --- |
| Routing file | Does the agent load the skill when it should, and leave it unloaded when it shouldn't? | `evals/skills/SKILL_NAME/routing.yaml` |
| Harbor skill task | Does an agent with the skill finish a realistic Phoenix task? | `evals/harbor/tasks/skills/SKILL_NAME/TASK_NAME/` |

Replace `SKILL_NAME` with the skill's folder name in `skills/`, for example
`phoenix-evals`. Cases live outside `skills/` so that `make skills`, the plugins, and
`npx skills add` don't ship them.

## Minimum case set

Every public skill needs the following cases:

- A routing file with at least 8 `load` cases and 8 `no-load` cases. At least 3 of the
  `no-load` cases have `kind: sibling`.
- At least 2 Harbor skill tasks with `kind = "smoke"`.

Skills that teach a practice, such as `phoenix-evals` and `phoenix-error-analysis`, grow
toward 5 tasks, with at least one `kind = "capability"` task.

## Harbor skill task

A Harbor skill task is an ordinary Harbor task, as described in
[Harbor evaluations for Phoenix](../harbor/README.md), with two additions in `task.toml`
and in `tests/expected.json`.

```text
evals/harbor/tasks/skills/phoenix-evals/run-correctness-experiment/
├── task.toml
├── instruction.md
├── solution/
└── tests/
    └── expected.json
```

To start a task, copy one of the templates in `evals/harbor/tasks/skills/_templates/`.
[Skill tasks](../harbor/tasks/skills/README.md) describes the templates and how to check
a task.

### Task metadata

Add these keys to the `[metadata]` table in `task.toml`:

```toml
[metadata]
fixture = "sample-app"
skill = "phoenix-evals"
kind = "smoke"
template = "build-eval"
```

| Key | Required | Value |
| --- | --- | --- |
| `skill` | Yes | The skill the task tests. It must match `SKILL_NAME` in the path. |
| `kind` | Yes | `smoke` or `capability`. Pull requests that change the skill run its `smoke` tasks. The weekly job runs both kinds. |
| `template` | Yes | The task template: `trace-questions`, `instrument-app`, `build-eval`, or `fix-code`. |
| `fixture` | Yes | The fixture that seeds Phoenix, as in other Harbor tasks. |

Set the task name in `[task]` to `arize/skill-SKILL_NAME-TASK_NAME`.

### Expected skills

`tests/expected.json` sets `skills_expected` to the task's skill, so every run also reports
`expected_skills_loaded`:

```json
{
  "skills_expected": ["phoenix-evals"],
  "skills_unexpected": "any_other"
}
```

These scores don't affect the reward.

### Verifier rules

Follow the general rules in
[Write a Harbor task](../harbor/tasks/skills/README.md#write-a-harbor-task). For Phoenix
tasks, they mean:

- Query Phoenix state after the agent finishes: spans, datasets, experiments, and
  annotations.
- For diagnosis tasks, seed the trace into Phoenix instead of pasting it into the
  instruction, and have the agent write `answer.json` with named fields, such as
  `failing_span_id` and `root_cause`.
