# Skill evals

This folder holds the cases that test the public skills in `skills/`. Cases live outside
`skills/` so that `make skills`, the plugins, and `npx skills add` don't ship them.

| Case | Question | Location |
| --- | --- | --- |
| Routing file | Does the agent load the skill when it should, and leave it unloaded when it shouldn't? | `evals/skills/SKILL_NAME/routing.yaml` |

Replace `SKILL_NAME` with the skill's folder name in `skills/`, for example
`phoenix-evals`.

## Routing file

A routing file lists queries and whether each one loads the skill. The runner sends each
query to each channel, stops at the first skill load or after 3 turns, and repeats each
query up to 3 times.

Every public skill needs a routing file with at least 8 `load` cases and 8 `no-load`
cases. At least 3 of the `no-load` cases have `kind: sibling`.

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

The channel names are `claude-code`, `codex`, `mcp`, and `pxi`. The runner has an
adapter for `claude-code` only. It skips the other channels and says so in its output.

### Case keys

| Key | Required | Value |
| --- | --- | --- |
| `query` | Yes | The user's message, written the way a user would type it. |
| `expect` | Yes | `load` or `no-load`. |
| `kind` | Yes | For `load` cases: `explicit`, `implicit`, or `contextual`. For `no-load` cases: `sibling` or `near-miss`. |
| `sibling` | When `kind` is `sibling` | The skill that should take the query instead. |
| `files` | No | Paths, relative to the routing file, to copy into the agent's working directory. Use this for `contextual` cases, where the request only makes sense next to code. Keep the files in the skill's `fixtures/` folder. |
| `split` | No | `train` or `validation`. The description optimizer uses this split. Cases without it count as `train`. |

The case kinds mean the following:

- `explicit`: the query names Phoenix or the skill's topic directly.
- `implicit`: the query describes the task without naming Phoenix or the skill.
- `contextual`: the query depends on files in the working directory.
- `sibling`: another Phoenix skill should load instead.
- `near-miss`: the query shares keywords with the skill but needs no Phoenix skill.

### Scoring

A case counts as loaded when the skill loads in at least 2 of 3 runs. The runner stops
after 2 runs when they agree, because a third run can't change the result. A suite fails
on a channel when its `load` recall falls below `min_recall`, or when the share of
`no-load` cases that load the skill rises above `max_false_load_rate`. The runner detects
loads with `harbor_verifiers.skills.loaded_skills`, the same parser the Harbor skill scores
use.

## Run the routing evals

The runner records each suite, one skill on one channel, as a Phoenix experiment on the
`skill-routing-SKILL_NAME` dataset. The experiment name holds the branch and commit, and
its metadata holds the skill's git tree hash, the agent and its version, the model, and the
channel.

1. Start Phoenix on `http://localhost:6006`, or set `PHOENIX_COLLECTOR_ENDPOINT` and
   `PHOENIX_API_KEY` for a remote server.
2. Run one skill's suite:

   ```bash
   uv run --package harbor-verifiers python -m evals.skills.runner --skill phoenix-evals
   ```

   Leave out `--skill` to run every routing file. Add `--no-record` to skip Phoenix.

The runner exits with 0 when every suite passes, 1 when a suite misses a threshold, and 2
when the run is incomplete: the cost cap stopped it, runs failed, or recording failed.

### Claude Code adapter

The Claude Code adapter runs `claude -p --output-format stream-json` with the
`arize-phoenix` plugin loaded from `plugins/claude/arize-phoenix` and no user
configuration: no settings files, MCP servers, `CLAUDE.md`, or auto-memory, and a scrubbed
environment. A `PreToolUse` hook on the `Skill` tool ends the session at the first skill
load.

The `--auth` option sets how Claude Code signs in:

- `subscription`, the default outside CI, uses your Claude Code login. It keeps your
  `HOME` because Claude Code reads the login from the macOS Keychain, and it never passes
  `ANTHROPIC_API_KEY` to the agent.
- `api-key`, the default in CI, gives the agent a temporary `HOME` and passes
  `ANTHROPIC_API_KEY`.

### Cost

`--max-cost-usd` caps the run. Default: 10. When the cap is reached, the runner starts no
new runs and exits with 2. Runs on a subscription report the list-price cost that Claude
Code computes.

A full run of the five routing files on `claude-sonnet-5-5` costs about
$MEASURED_COST.

### Tests

To test the runner and check every routing file against the minimum, run:

```bash
uv run --package harbor-verifiers python -m pytest evals/skills/tests
```

## Continuous integration

The `Skill routing evals` workflow in `.github/workflows/skill-routing-evals.yml` runs on
pull requests that change a skill's `SKILL.md`, the MCP skill instructions, a routing file,
or the runner. `python -m evals.skills.runner.affected` picks the suites to run:

- A changed description reruns every suite that shares a channel with that skill, because
  a reworded description can pull queries away from its siblings. A `SKILL.md` change that
  leaves the description alone runs nothing.
- A changed routing file reruns that skill's suite.
- A change to the runner or the workflow reruns every suite.
