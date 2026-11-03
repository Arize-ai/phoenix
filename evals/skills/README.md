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

## Routing file

A routing file lists queries and whether each one loads the skill. The runner sends each
query to each channel, stops at the first skill load or after 3 turns, and repeats each
query 3 times.

```yaml
skill: phoenix-evals
channels: [claude-code, mcp]
thresholds:
  min_recall: 0.8
  max_false_load_rate: 0.1
cases:
  - query: "Write a judge that checks whether our support bot's answers are grounded in the retrieved docs"
    expect: load
    kind: implicit
  - query: "Set up a correctness eval on my Phoenix dataset and run it as an experiment"
    expect: load
    kind: explicit
  - query: "Why are my LangChain spans missing the model name?"
    expect: no-load
    kind: sibling
    sibling: phoenix-tracing
  - query: "Write unit tests for this date parser"
    expect: no-load
    kind: near-miss
```

### Top-level keys

| Key | Required | Value |
| --- | --- | --- |
| `skill` | Yes | The skill's folder name. It must match `SKILL_NAME` in the path. |
| `channels` | No | The channels to test. Default: the channels in the skill's `metadata.targets`, where `agents` maps to `claude-code`. |
| `thresholds` | No | The pass thresholds. Default: `min_recall: 0.8` and `max_false_load_rate: 0.1`. |
| `cases` | Yes | The list of cases. |

The channel names are `claude-code`, `codex`, `mcp`, and `pxi`. A runner that has no
adapter for a listed channel skips that channel and says so in its output.

### Case keys

| Key | Required | Value |
| --- | --- | --- |
| `query` | Yes | The user's message, written the way a user would type it. |
| `expect` | Yes | `load` or `no-load`. |
| `kind` | Yes | For `load` cases: `explicit`, `implicit`, or `contextual`. For `no-load` cases: `sibling` or `near-miss`. |
| `sibling` | When `kind` is `sibling` | The skill that should take the query instead. |
| `files` | No | Paths, relative to the routing file, to place in the agent's working directory. Use this for `contextual` cases, where the request only makes sense next to code. |
| `split` | No | `train` or `validation`. The description optimizer uses this split. Cases without it count as `train`. |

The case kinds mean the following:

- `explicit`: the query names Phoenix or the skill's topic directly.
- `implicit`: the query describes the task without naming Phoenix or the skill.
- `contextual`: the query depends on files in the working directory.
- `sibling`: another Phoenix skill should load instead.
- `near-miss`: the query shares keywords with the skill but needs no Phoenix skill.

### Scoring

A case counts as loaded when the skill loads in at least 2 of 3 runs. The skill fails on a
channel when its `load` recall falls below `min_recall`, or when the share of `no-load`
cases that load it rises above `max_false_load_rate`. Loads are detected with
`harbor_verifiers.skills.loaded_skills`, the same parser the Harbor skill scores use.

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

The verifier decides the reward from what the agent did, not from how its reply reads:

- Query Phoenix state after the agent finishes: spans, datasets, experiments, and
  annotations.
- When the agent writes code, run that code against the server.
- For diagnosis tasks, have the agent write `answer.json` with named fields, such as
  `failing_span_id` and `root_cause`, and seed the trace into Phoenix instead of pasting it
  into the instruction.
- The reference solution in `solution/` must pass. Check it with `-a oracle`.
- An agent that does nothing must fail.
- Use an LLM judge only when Phoenix state can't decide the result.
