---
name: create-task
description: Create a new Harbor task for evaluating agents. Use when the user wants to 
  scaffold, build, or design a new task, benchmark problem, or eval. Guides through 
  instruction writing, environment setup, verifier design (pytest vs Reward Kit vs 
  custom), and solution scripting.
---

Guide the user through creating a new Harbor task end-to-end. Don't just dump commands — 
walk them through each decision, especially around the verifier (which is usually the 
hardest part).

## Step 1: Scaffold the task

```bash
harbor task init "<org>/<task-name>"
```

Useful flags:
- `--description "..."`
- `--author "Jane Doe <jane@example.com>"` (repeat for multiple authors)
- `--no-pytest` — skip the pytest test template (use if planning Reward Kit or custom verifier)
- `--no-solution` — skip solution/ directory
- `--metadata-template path.toml` — pre-populate task.toml

Produces:
```
<task-name>/
├── instruction.md         # Task prompt for the agent
├── task.toml              # Config and metadata
├── environment/Dockerfile # Container definition
├── solution/solve.sh      # Reference solution (optional)
└── tests/test.sh          # Verifier script
```

If the user wants a **multi-step task** (ordered steps with per-step
instructions, tests, and early stopping against a shared container), scaffold
the single-step layout first, then convert to the `steps/` layout described in
the *Multi-step tasks* section below.

## Step 2: Write instruction.md

This is the prompt the agent receives. Help the user write it clearly:

- **State the goal concretely** — what file to create, what behavior to produce
- **Specify expected outputs** — paths, formats, content
- **Include constraints** — language, tools, approach
- **Don't leak the tests** — describe what "done" looks like, not how you'll check it

Example (from the ssh-key-pair tutorial):
```markdown
# SSH Key Pair Generation

Generate an SSH key pair in the files `~/.ssh/id_rsa` and `~/.ssh/id_rsa.pub`.

Don't make them password protected.
```

## Step 3: Build the environment

Edit `environment/Dockerfile` to install dependencies the task needs. The agent works 
inside this container.

```dockerfile
FROM ubuntu:24.04
WORKDIR /app

# Install what the task requires — NOT the solution
RUN apt-get update && apt-get install -y openssh-client && rm -rf /var/lib/apt/lists/*
```

For multi-container setups, use `environment/docker-compose.yaml` instead (note: most 
cloud sandbox providers only support Dockerfile).

**Test the environment interactively** before writing the solution or tests:
```bash
harbor task start-env -p "<task-path>" -e docker -a -i
```

This is usually where task authors realize something is missing from the Dockerfile.

## Step 4: Decide how to verify

**This is the most important decision.** Ask the user: *"How do you want to grade this 
task?"* Then help them pick:

Also ask: *"Should the verifier run in the same environment as the agent, or in a
separate verifier environment?"*

- Use the default shared environment when tests need to inspect the agent's full
  workspace, installed tools, or services.
- Use a separate verifier environment when grading code, dependencies, API keys,
  or OS requirements should stay hidden from the agent, or when verification
  should run from a clean image.

For a separate verifier container, `tests/` is the verifier image build context
and the image must provide `/tests/test.sh` (Linux) or `/tests/test.bat`
(Windows). Harbor copies `/logs/artifacts` and configured artifacts into the
verifier environment, not the agent's whole workspace.

```toml
[verifier]
environment_mode = "separate"

[verifier.environment]
docker_image = "ubuntu:24.04"
```

### Option A: Reward Kit (recommended for most cases)

Use when the verifier has multiple criteria, needs partial credit, uses an LLM/agent 
judge, or would benefit from composable reusable checks. See the `rewardkit` skill.

Good fit signals:
- Multiple things to check (file exists + content correct + command works)
- Subjective quality dimensions (readability, correctness of prose)
- Want partial credit rather than pass/fail
- Want to compose built-ins like `file_contains`, `command_succeeds`, `json_key_equals`

`tests/test.sh`:
```bash
#!/bin/bash
uvx --from 'harbor-rewardkit==0.2.*' rewardkit /tests
```

Note: the package is named `harbor-rewardkit` but the executable is `rewardkit`,
hence `--from 'harbor-rewardkit==0.2.*' rewardkit`. Running
`uvx harbor-rewardkit` directly will fail.

Then add `tests/checks.py` and/or `tests/judge.toml`. Invoke the `rewardkit` skill to 
design the criteria.

### Option B: pytest (good for deterministic unit-style checks)

Use when the verification is straightforward assertion-style Python. Default template if 
`--no-pytest` wasn't passed.

`tests/test.sh`:
```bash
#!/bin/bash
apt-get update && apt-get install -y curl
curl -LsSf https://astral.sh/uv/0.9.7/install.sh | sh
source $HOME/.local/bin/env

uvx --with pytest==8.4.1 pytest /tests/test_outputs.py

if [ $? -eq 0 ]; then
  echo 1 > /logs/verifier/reward.txt
else
  echo 0 > /logs/verifier/reward.txt
fi
```

Example `tests/test_outputs.py`:
```python
from pathlib import Path

def test_file_exists():
    assert (Path.home() / ".ssh" / "id_rsa").exists()
```

### Option C: Custom shell

For simple single-command checks (e.g. a binary pass/fail from one command):
```bash
#!/bin/bash
if diff -q /app/output.txt /tests/expected.txt; then
  echo 1 > /logs/verifier/reward.txt
else
  echo 0 > /logs/verifier/reward.txt
fi
```

### Reward file format (all options)

- `/logs/verifier/reward.txt` — single number (usually `0` or `1`)
- `/logs/verifier/reward.json` — `{"accuracy": 0.95, "runtime_sec": 1.2}` for multiple metrics

**Always use absolute paths in `test.sh`.**

## Step 5: Write the solution

Write `solution/solve.sh` — a script that actually solves the task. The Oracle agent runs 
this to sanity-check that the task is solvable and the tests pass on a correct solution.

```bash
#!/bin/bash
ssh-keygen -t rsa -f ~/.ssh/id_rsa -N ""
```

Make it executable: `chmod +x solution/solve.sh`.

## Step 6: Configure task.toml

Walk through the important fields:

```toml
[task]
name = "<org>/<task-name>"
version = "1.0.0"
description = "One-line description"
keywords = ["jax", "mnist", "rewardkit"]  # always populate — used for search/filtering

[metadata]
difficulty = "easy" | "medium" | "hard"
category = "programming" | "machine-learning" | "gpu" | ...
tags = ["..."]

[agent]
timeout_sec = 120.0       # How long the agent has

[verifier]
timeout_sec = 600.0       # How long tests have

[environment]
network_mode = "public"   # Baseline at env start (defaults to public)
cpus = 1                  # CPU cores
memory_mb = 2048          # RAM in MB
storage_mb = 10240        # Disk in MB
```

**Always populate `keywords`.** Pick 3–8 lowercase tokens covering the domain
(language/framework/benchmark family), the verifier style (`rewardkit`,
`judge-grading`, `pytest`), and any notable hardware (`gpu`). They're surfaced in
`harbor datasets list` and registry search.

### Network policy

Network access has three layers:

1. **Baselines** — set when an environment starts, restored between phases
2. **Phase overrides** — optional; only during `agent.run()` or `verify()`
3. **Run-time merges** — `--allow-environment-host`, `--allow-agent-host` on `harbor run`

| Field | Layer | When applied |
| --- | --- | --- |
| `[environment].network_mode` | Baseline | Agent env start; shared verifier uses this too |
| `[verifier.environment].network_mode` | Baseline | Separate verifier env start |
| `[agent].network_mode`, `[steps.agent].network_mode` | Override | During matching `agent.run()` |
| `[verifier].network_mode`, `[steps.verifier].network_mode` | Override | During matching `verify()` |
| `--allow-environment-host` | Run-time | Merged into `environment.extra_allowed_hosts` → `[environment]` baseline |
| `--allow-agent-host` | Run-time | Merged into `agent.extra_allowed_hosts` → agent phase allowlist |

Modes: `public`, `no-network`, or `allowlist` with `allowed_hosts = ["pypi.org"]`
(exact hostnames, IPv4/IPv6 address literals or CIDR ranges, or leading wildcard hostnames, when supported by the selected environment; not URLs,
ports, or paths). Omitting `[environment].network_mode` defaults to `public`.

`[agent]` / `[verifier]` are **optional phase overrides** — only applied when set
**and** different from the phase baseline. Matching the baseline is a no-op.

**Shared verifier** (default): verifier runs in the agent container; baseline is
`[environment]`. **Separate verifier**: baseline is `[verifier.environment]` if
set, else a copy of `[environment]`.

```toml
# Agent starts offline; agent phase opens network; verifier stays offline
[environment]
network_mode = "no-network"

[agent]
network_mode = "public"

[verifier]
network_mode = "no-network"
```

If a phase override differs from its baseline, the environment provider must
support `dynamic_network_policy` (E2B does; plain Docker does not). Prefer
`environment_mode = "separate"` when agent and verifier need different baselines
without runtime switching:

```toml
[environment]
network_mode = "no-network"

[verifier]
environment_mode = "separate"

[verifier.environment]
network_mode = "public"   # Verifier baseline — not a phase override
```

Run-time host flags for eval jobs without editing `task.toml`:

```bash
harbor run -p "<task-path>" -a oracle \
  --allow-environment-host pypi.org \   # env start (Dockerfile apt/curl)
  --allow-agent-host files.pythonhosted.org   # agent.run() only
```

On a `public` baseline, run-time host flags emit a warning and are ignored.

Examples: `examples/tasks/network-policy-matrix/`. Full reference:
`docs/content/docs/tasks/index.mdx` (Network policy section).

For Reward Kit judges needing API keys:
```toml
[verifier.env]
ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}"
```

## Step 7: Verify with the Oracle agent

```bash
harbor run -p "<task-path>" -a oracle
```

Oracle runs `solution/solve.sh` and then the verifier. Reward should be `1.0`. If it's 
not, debug in this order:
1. Does `solve.sh` actually solve it? (`start-env -a -i` and run it manually)
2. Does the verifier correctly detect success? (check `/logs/verifier/` output)
3. Are paths correct? (absolute vs relative)
4. Are dependencies installed in the Dockerfile?

## Step 8: Test with a real agent (optional)

```bash
harbor run -p "<task-path>" -a terminus-2 -m anthropic/claude-sonnet-4-6
```

If the task is too easy (every model 1.0) or impossible (every model 0.0), consider 
adjusting difficulty.

## Step 9: Update README.md (always the final step)

`harbor task init` leaves `README.md` as a stub. Before wrapping up, populate it so
future humans (and agents) can understand the task without reading every file.
Include:

- **What the agent does** — one paragraph, link to `instruction.md`.
- **Environment** — base image, key installed packages, cached data, hardware
  (GPU/CPU/RAM), agent timeout.
- **Verifier** — for Reward Kit tasks, a table of reward dimensions with type
  (programmatic / LLM judge / agent judge) and what each measures; how they're
  aggregated.
- **Layout** — a tree of the task directory with one-line annotations.
- **Running** — the concrete `harbor run` commands (Oracle + real agent), with the
  right provider flag if the task needs a GPU.

Treat this as docs, not marketing — the reader wants to know *what they'd need to
change* to modify the task.

## Multi-step tasks

Use when the work splits into ordered phases that should be scored separately,
when you want early stopping between phases, or when you're testing an agent's
ability to build on its own prior work. Steps share one container; files
persist across steps.

### Directory layout

Replace the task-root `instruction.md`, `tests/`, and `solution/` with a
`steps/` directory containing one sub-directory per step:

Each `[[steps]].name` must match one directory name of at most 255 UTF-8 bytes,
unique after case folding and Unicode normalization. Avoid path separators,
control characters, Windows-reserved characters/device names, and trailing dots
or spaces. Keep all task inputs and linked contents within the task directory;
validation permits shared links inside the task. Use regular files and directories
for shared inputs when publishing tasks.

```
<task-name>/
├── task.toml
├── environment/Dockerfile       # Built once, shared across all steps
├── steps/
│   ├── scaffold/
│   │   ├── instruction.md       # Prompt for this step
│   │   ├── workdir/             # Uploaded to WORKDIR before the agent runs
│   │   │   └── setup.sh         # Optional pre-agent hook (reserved filename)
│   │   ├── tests/test.sh        # Per-step verifier
│   │   └── solution/solve.sh    # Per-step Oracle solution (optional)
│   ├── implement/
│   │   └── ...
│   └── document/
│       └── ...
└── tests/                       # Optional shared helpers + fallback test.sh
```

Task-level `tests/` is uploaded to `/tests` for each step's verification, then
the step's own `tests/` is layered on top (same-name files win). Use this for
shared helpers.

`steps/{name}/workdir/setup.sh` is a **reserved filename**: if present, it runs
after the `workdir/` upload and before the agent, as the step's agent user,
with cwd = WORKDIR. Non-zero exit aborts the step and the trial. Have it
`rm -- "$0"` on its last line if the agent shouldn't see it.

### task.toml

```toml
schema_version = "1.4"

[task]
name = "<org>/<task-name>"
version = "1.0.0"

# How per-step rewards roll up into the trial-level verifier_result.
# "mean" (default): per-key mean across steps that produced a result.
# "final": the last step's verifier_result verbatim.
multi_step_reward_strategy = "mean"

[[steps]]
name = "scaffold"              # Must match the directory under steps/
min_reward = 1.0               # Abort trial if this step's reward < 1.0
[steps.agent]
timeout_sec = 60.0             # Overrides task-level [agent].timeout_sec
[steps.verifier]
timeout_sec = 30.0

[[steps]]
name = "implement"
# Dict form gates on specific keys from a multi-dim reward:
min_reward = { correctness = 0.8, style = 0.5 }
[steps.agent]
timeout_sec = 120.0
[steps.verifier]
timeout_sec = 30.0

[[steps]]
name = "document"
[steps.agent]
timeout_sec = 60.0
[steps.verifier]
timeout_sec = 30.0
```

Per-step overrides available: `agent.timeout_sec`, `agent.user`,
`agent.network_mode`, `verifier.timeout_sec`, `verifier.env`, `verifier.user`,
`verifier.network_mode`, `verifier.environment_mode`, `verifier.environment`,
`steps.verifier.environment.network_mode`, `healthcheck.*`, `artifacts`. Unset
fields fall back to the task-level values.

### Choosing a reward strategy

- **`"mean"`** — aggregate signal across all steps; good for continuous
  progress rewards.
- **`"final"`** — last step's verifier_result is the trial reward. Right when
  the final step is an end-to-end check whose dict already represents the full
  task. Caveat: if `min_reward` triggers an early abort, `"final"` uses the
  *aborted* step's result, not the intended final step.

### Artifacts

Step-level `artifacts` are collected into `steps/{name}/artifacts/` after that
step's verification. Task-level and trial-level artifacts are collected at
every step in addition to the step-level ones.

### Oracle verification

`harbor run -p "<task-path>" -a oracle` runs each step's `solution/solve.sh`,
then each step's verifier, in order. Trial reward should be `1.0` across the
aggregation strategy.

### Full reference + worked example

- Docs: `docs/content/docs/tasks/multi-step.mdx`
- Example task: `examples/tasks/hello-multi-step-advanced/`

## Special features (mention if relevant)

- **Network policy**: Baselines on `[environment]` / `[verifier.environment]`; phase
  overrides on `[agent]` / `[verifier]`; see *Network policy* under Step 6
- **MCP servers**: Add `[[environment.mcp_servers]]` in task.toml for agent tooling
- **Healthcheck**: Add `[environment.healthcheck]` for services that need to be ready
- **GPU**: Set `environment.gpus` and optionally `environment.gpu_types`
- **Pre-built image**: Set `environment.docker_image` instead of building from Dockerfile. You can omit `environment/Dockerfile` and place runtime files (configs, scripts, data) directly under `environment/`; Harbor uploads them into the container workdir when the environment starts.
- **Non-root user**: Set `agent.user` / `verifier.user` for isolation

## Common pitfalls

- Forgetting to write the reward file → task "passes" silently with reward 0
- Using relative paths in `test.sh` → breaks when Harbor runs it from a different cwd
- Installing the solution into the Dockerfile → agent already gets the answer
- Test script leaks into `instruction.md` → agent sees the rubric and gaming becomes trivial
- Forgetting `chmod +x solution/solve.sh` → Oracle agent fails
- Leaving `keywords = []` in task.toml → task is invisible to registry search
- Leaving `README.md` as a stub → teammates have no way to understand the task at a glance
- Putting `network_mode` on `[agent]` expecting it to apply at env start → use
  `[environment].network_mode` for the baseline; agent/verifier fields are phase overrides
- Phase override differs from baseline on Docker → task rejected unless provider supports
  `dynamic_network_policy`; use separate verifier env or match the baseline instead
