---
name: rewardkit
description: Write Harbor task verifiers using Reward Kit. Use when creating or editing a 
  task's tests/ directory, adding grading criteria, setting up LLM/agent judges, or designing 
  verifiers that produce a reward score.
---

Help the user write task verifiers with Reward Kit. Reward Kit is a lightweight Python 
package that turns a directory of criteria files into a reward score. Each criterion is a 
Python function call or a TOML judge file; folders become separate rewards.

## Setup in a Harbor task

Put criteria alongside `test.sh` in the task's `tests/` directory:

```
tests/
├── test.sh
├── checks.py         # programmatic criteria
└── judge.toml        # optional LLM/agent judge
```

`tests/test.sh`:
```bash
#!/bin/bash
uvx --from 'harbor-rewardkit==0.2.*' rewardkit /tests
```

This runs all criteria in `/tests/` against the workspace at `/app` and writes 
`/logs/verifier/reward.json`. Defaults match Harbor's conventions — no extra config needed.

If judge criteria need API keys, pass them through `task.toml`:
```toml
[verifier.env]
ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}"
```

Ask whether Reward Kit should run in the agent's shared environment or in a
separate verifier environment. Prefer a separate verifier environment when judge
prompts, grading dependencies, API keys, or clean-room checks should not be
available to the agent:

```toml
[environment]
network_mode = "no-network"   # Agent env baseline — offline during agent.run()

[verifier]
environment_mode = "separate"

[verifier.environment]
network_mode = "public"     # Verifier env baseline — LLM judge API calls
docker_image = "python:3.12-slim"
```

In shared mode, the verifier runs in the agent container and inherits
`[environment].network_mode`. Put `[verifier].network_mode` only when verify()
needs different network access than the agent phase (a phase override, not a
baseline). If agent and verifier need different baselines without runtime
switching, use `environment_mode = "separate"` and set
`[verifier.environment].network_mode`.

Judge criteria that call external APIs need a `public` baseline or allowlist on
the verifier environment. Programmatic checks that only read local files can use
`no-network`.

In separate mode, `tests/` is the verifier image build context and must provide
`/tests/test.sh` at runtime; Harbor does not upload `tests/` into the running
verifier container.

## Programmatic criteria

Call built-ins from any `.py` file in `tests/`:

```python
import rewardkit as rk

rk.file_exists("output.txt")
rk.file_contains("output.txt", "hello")
rk.command_succeeds("python main.py", weight=2.0)
rk.json_key_equals("result.json", "status", "ok")
```

All criteria accept `weight` (default `1.0`) and `isolated` (default `False`, runs in 
overlayfs so side effects don't leak).

### Available built-ins

- **Files**: `file_exists`, `file_not_exists`, `file_contains`, `file_contains_regex`, 
  `file_matches`, `files_equal`, `diff_ratio`
- **Commands**: `command_succeeds`, `command_output_contains`, `command_output_matches`, 
  `command_output_matches_regex` (30s default timeout, optional `cwd`)
- **Data**: `json_key_equals`, `json_path_equals`, `csv_cell_equals`, `xlsx_cell_equals` 
  (needs `[office]` extra), `sqlite_query_equals`
- **HTTP**: `http_status_equals`, `http_response_contains`
- **Images**: `image_similarity`, `image_size_equals` (needs `[image]` extra)
- **Trajectory**: `trajectory_tool_used`, `trajectory_tool_not_used`, `trajectory_turn_count`

For extras, install with `uv tool install harbor-rewardkit[all]`.

## Custom criteria

Use the `@criterion` decorator. First parameter is always `workspace: Path`. Returns 
`bool` or `float`:

```python
from pathlib import Path
from rewardkit import criterion

@criterion
def has_valid_output(workspace: Path) -> bool:
    return (workspace / "output.txt").read_text().strip() != ""
```

Zero-parameter criteria auto-register. Criteria with extra args must be called via `rk`:

```python
@criterion(description="output has at least {n} lines")
def has_n_lines(workspace: Path, n: int) -> bool:
    return len((workspace / "output.txt").read_text().splitlines()) >= n

rk.has_n_lines(10, weight=2.0)
rk.has_n_lines(50, weight=1.0)
```

For criteria shared across reward subdirs, define with `shared=True` in a root-level file 
and call from subdirs.

## Judge criteria (LLM or agent-as-a-judge)

For subjective checks (quality, readability, edge cases), create a TOML file:

```toml
[judge]
judge = "anthropic/claude-sonnet-5"   # LiteLLM model string
files = ["/app/main.py"]

[[criterion]]
description = "Is the code correct?"
type = "binary"

[[criterion]]
description = "How readable is the code?"
type = "likert"
points = 5
weight = 2.0
```

Criterion types:
- `binary` — yes/no → 1.0 or 0.0
- `likert` — 1..points, normalized to [0, 1]
- `numeric` — min..max, normalized to [0, 1]
- `rubric` — 2 to 10 described `levels` forming a scale from worst to best; position sets the score

### Agent judges

Agent judges shell out to a CLI and can explore the filesystem:

```toml
[judge]
judge = "claude-code"
model = "anthropic/claude-sonnet-5"
isolated = true

[[criterion]]
description = "Does the solution handle edge cases?"
type = "binary"
```

Slower and more expensive than LLM judges, but they can run commands and inspect files.

### JEV judge

JEV is a new type of language model from TypeSafe. It answers each criterion with a probability or a rubric
score and returns no reasoning, so it is fast and cheap. It needs the `jev` extra
(`harbor-rewardkit[jev]`) and `TYPESAFE_API_KEY`.

```toml
[judge]
judge = "jev"
files = ["/app/answer.md"]

[[criterion]]
description = "Does the answer address the requested task?"

[[criterion]]
description = "How complete is the answer?"
type = "rubric"
levels = ["Omits the information", "Covers part of it", "Covers all of it"]
```

Binary criteria pass at a probability of 0.5 or higher. Only `binary` and `rubric` criteria and
text files are supported; `atif-trajectory` and `prompt_template` are not.
The task image needs CA certificates (`ca-certificates` on Debian and Ubuntu), because the
TypeSafe SDK verifies TLS against the system trust store.

### Useful `[judge]` options

`timeout` (default 300), `reasoning_effort` (`low`|`medium`|`high`), `reference` (path to 
reference solution), `atif-trajectory` (evaluate the agent's trajectory), `weight`, 
`prompt_template` (custom prompt with `{criteria}` placeholder).

### Scoring aggregation (within one judge TOML)

```toml
[scoring]
aggregation = "all-pass"   # weighted-mean | weighted-sum | all-pass | any-pass | threshold | required-pass
threshold = 0.7             # only for threshold
```

Only affects how this file's own criteria combine. To aggregate *across*
dimensions, see [Aggregating dimensions](#aggregating-dimensions).

### Scoring config for programmatic files

Each `.py` file that registers criteria is an equal-weighted scoring component
named after its filename stem. Files that only provide imports or shared
criterion factories and register no checks are ignored. To change how criteria
within a file combine, use `[scoring.<stem>]` in the same directory's
`reward.toml`:

```toml
# tests/structure/reward.toml
[scoring.files_exist]       # configures files_exist.py
aggregation = "all-pass"

[scoring.behavior]          # configures behavior.py
aggregation = "threshold"
threshold = 0.75
```

Each entry takes the same aggregation values as a judge TOML. Unknown keys and
stems that do not resolve to a criterion-bearing Python file raise.

Directories may be nested recursively. A non-root directory can aggregate its
local Python files, local judges, and immediate child directories with one
unnamed `[[reward]]` table:

```toml
# tests/correctness/reward.toml
[[reward]]
aggregation = "weighted-mean"
weights = { files = 2.0, behavior = 1.0 }
```

Membership is implicit. Child directories have weight 1.0 unless overridden;
use filename stems for local Python files and judge TOMLs, and directory names
for child groups. Without `[[reward]]`, the directory defaults to weighted mean.

## Multi-reward tasks

Put criteria in subdirectories — each becomes a separate reward:

```
tests/
├── test.sh
├── correctness/
│   └── check.py
├── structure/
│   └── files_exist.py
└── quality/
    └── quality.toml
```

Judge TOMLs may also sit directly at the tests root alongside reward
subdirectories. Each is exposed as a top-level reward named after its filename
stem and can be referenced by a root aggregation.

Criterion-bearing Python files at the tests root are also top-level dimensions
named after their stems. Root support files that register no criteria are
ignored.

Produces:
```json
{ "correctness": 0.75, "structure": 1.0, "quality": 0.6 }
```

### Aggregating dimensions

To add aggregated scores on top of the per-dimension keys, add a root-level
`tests/reward.toml` with one or more `[[reward]]` tables. Each adds one key to
`reward.json`, aggregating the dimensions with the same modes as `[scoring]`:

```toml
# tests/reward.toml
[[reward]]
name = "reward"
aggregation = "all-pass"   # weighted-mean | weighted-sum | all-pass | any-pass | threshold | required-pass
# threshold = 0.7          # only for threshold
weights = { correctness = 2.0, quality = 1.0 }
```

```json
{ "correctness": 0.75, "structure": 1.0, "quality": 0.6, "reward": 0.0 }
```

The per-dimension scores stay; aggregated keys are added alongside them (a
`name` may not collide with a dimension). Top-level dimensions have equal
weight unless that aggregation's inline map overrides them;
`reward-details.json` keeps the full recursive breakdown.

## Output files

- `/logs/verifier/reward.json` — per-reward scores
- `/logs/verifier/reward-details.json` — per-criterion results, judge reasoning, errors

## Multi-step tasks

In a multi-step task, each step has its own `tests/` under
`steps/{name}/tests/`, and the verifier runs once per step. Reward Kit behaves
the same as in a single-step task: for each step it reads `/tests`, runs the
criteria against `/app`, and writes `/logs/verifier/reward.json` for that step.
Harbor then aggregates per-step results into a trial-level reward via
`multi_step_reward_strategy` in `task.toml` — aggregation happens *outside*
Reward Kit, so don't try to encode cross-step logic in your criteria.

A task-level `tests/` directory (at the task root) is uploaded to `/tests`
first, then the step's own `tests/` is layered on top (same-name files win).
Put shared helpers (common `checks.py` functions with `shared=True`, fixture
files, a fallback `test.sh`) at the task level, and step-specific criteria
under each step.

Multi-reward subdirectories still work *within* a step: `steps/foo/tests/`
can contain `correctness/`, `structure/`, `quality/` — each produces a
separate reward key for that step, and `multi_step_reward_strategy = "mean"`
averages each key across steps. Use `"final"` when the last step is an
end-to-end check whose rewards already represent the full task.

## When to reach for what

- **Use built-ins** for file existence, string matches, command output, JSON/CSV checks, 
  HTTP probes.
- **Use `@criterion`** when logic is task-specific but still programmatic.
- **Use LLM judges** for subjective quality dimensions (readability, correctness of prose).
- **Use agent judges** when the rubric requires exploring the filesystem or running code 
  (e.g. "does the test suite actually pass?").
- **Use subdirectories** when you want separate scores (correctness vs structure vs 
  quality) rather than one blended number.
- **Use `isolated=True`** for any criterion that runs mutating commands, so it doesn't 
  corrupt the workspace for other criteria.

## Working example

See `examples/tasks/reward-kit-example/` in the Harbor repo.
