---
name: harbor-exec
description: "Use when working with Harbor's `harbor exec` CLI workflow: compiling files, directories, or globs into Harbor tasks; running map jobs; configuring artifacts and existence-only verification; using map-reduce; writing or reviewing ExecConfig YAML/JSON/TOML; or debugging command behavior, config validation, and job outputs."
---

# Harbor Exec

## Overview

Use this skill to operate Harbor's `harbor exec` command. Treat `harbor exec` as agentic map-reduce: it turns loose inputs into Harbor tasks, runs Harbor jobs over those tasks, and optionally aggregates the results.

## First Checks

Assume the user is running an installed Harbor CLI. Check the installed command surface before making claims:

```bash
harbor --version
harbor exec --help
```

Require Harbor `>=0.17.1` for `harbor exec`. If `harbor --version` reports an older version, ask the user to upgrade before continuing.

Use `--print-config` when debugging config resolution, inferred artifacts, task/job directories, or defaults. Do not treat it as a substitute for showing the final launch command.

If the installed `harbor` command is not available, ask the user how they installed Harbor before guessing a command path.

## Run Parameter Questions

Before running a Harbor Exec job, ask the user to confirm any unspecified run parameters:

- Inputs: exact paths/globs and whether to `--scan` or `--no-scan`.
- Artifact contract: output file paths the agent must write.
- Artifact schemas: required JSON or structured schema for each artifact.
- Environment provider: recommend cloud sandboxing over local `docker`; suggest `modal`, `daytona`, or `e2b`.
- Agent and model for the map step.
- Concurrency count.
- Whether to include a reduce step, and if so which reduce agent and model to use.
- Final command: show the exact launch command before running it.

## Usage Workflow

Prefer flags for one-off runs and `--config` for repeatable or map-reduce workflows.

Make artifacts explicit when correctness depends on generated files:

```bash
harbor exec -p ./input -i "Write /app/answer.json" -f /app/answer.json
```

Prefer explicit artifacts over auto-inferred artifacts. Auto-inference only reads inline instructions, not instruction files.

Do not persist compiled tasks by default. Omit `--tasks-dir` unless the user wants to inspect or reuse compiled tasks; when omitted, compiled tasks are ephemeral and cleaned up after execution.

Leave the job output location unset by default. Use `--jobs-dir` only when the user wants a specific output path; default is `jobs`.

Specify `--scan` or `--no-scan` when task cardinality matters. Current flags mode scans a single directory or glob by default, but multiple paths are grouped unless `--scan` is explicit.

Do not combine `--config` with flags mode options. Build the full `ExecConfig` in the file instead.

## Map And Reduce

Map phase:

- `map.compile` defines task synthesis: instructions, copied paths, Docker image/workdir, artifacts, templates, and compile-time verifier generation.
- `map.job` defines execution: agent, model, environment provider, retries, attempts, concurrency, metrics, and job directory.

Reduce phase:

- Requires `map.compile.artifacts`; the reducer consumes prior map trial artifacts staged under `environment/artifacts`.
- Compiles exactly one reducer task.
- Inherits map job settings unless reducer-specific flags/config override them in flags mode.
- Should usually define reducer artifacts explicitly, then verify them.

## Examples

Read `references/examples.md` when writing concrete commands, config files, or map-reduce examples.
