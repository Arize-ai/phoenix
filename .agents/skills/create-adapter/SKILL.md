---
name: create-adapter
description: Scaffold a new Harbor benchmark adapter by running `harbor adapter init` and then guide implementation using the Adapters Agent Guide as the authoritative spec.
---

# Create Adapter

Bootstrap a new benchmark adapter in the Harbor repository. This skill scaffolds the adapter directory with `harbor adapter init` and then defers to the adapter tutorial for every implementation decision.

## Authoritative reference

The adapter tutorial is the authoritative specification for this skill. Read it in full before taking any action beyond scaffolding:

```
docs/content/docs/datasets/adapters.mdx
```

That path is relative to the Harbor repo root (a skill prerequisite — see below). The tutorial contains:

- Required directory structures for the generated tasks and the adapter code package.
- Step-by-step process (steps 1-9) covering benchmark analysis, oracle verification, parity experiments, dataset registration, and submission.
- Schemas for `task.toml`, `parity_experiment.json`, `adapter_metadata.json`, and `dataset.toml`.
- Parity matching criterion, pre-flight checklist, and debug playbook.
- README format rules (machine-parsed; deviations break automation).

Do not substitute prior knowledge for the contents of that file. Treat it as the contract.

## Prerequisites

- Harbor CLI is installed and available on `PATH` (`harbor --version` succeeds).
- Working directory is the Harbor repository root.
- Harbor checkout is current: run `git fetch origin && git status` and pull `main` if behind. Stale checkouts miss recent adapter and agent fixes and are a common source of spurious parity failures later on.

## Workflow

### 1. Read the tutorial

Before any filesystem or CLI action, Read `docs/content/docs/datasets/adapters.mdx` in full. Pay particular attention to:

- **Required Directory Structures** — the contract for generated task and adapter layouts.
- **Step 1. Understand the Original Benchmark** — what to identify upstream before coding.
- **Step 8. Register the Dataset → Naming rules** — the `name` field and `<org>/<task>` format requirements.

### 2. Gather benchmark context from the user

Collect the following before scaffolding. If the user has not provided an item, ask before proceeding — these inputs shape the scaffold and the tutorial steps that follow.

| Field | Why it matters |
|-------|---------------|
| Adapter name | Lowercase, hyphen-separated. Must match the benchmark's common identifier (e.g., `swe-bench`, `aider-polyglot`). Becomes the directory under `adapters/` and, after underscore conversion, the Python package name. |
| Human-readable name | Passed via `--name`; appears in the generated README. |
| Upstream repo URL | Needed for tutorial Step 1 (benchmark analysis) and for the `original_parity_repo` field later. |
| Oracle solutions available? | If the benchmark ships reference solutions, use them. If not, oracle solutions must be LLM-generated (tutorial Step 3 → "Benchmarks without oracle solutions"). |
| Agent scenario | Which of Step 4's scenarios applies: (1) existing compatible agent, (2) fork + add LLM agent, or (3) custom agent. This shapes the parity plan. |

### 3. Create the adapter branch

Per tutorial Step 2, work on a dedicated branch:

```bash
git checkout -b <adapter-name>-adapter
```

### 4. Run the scaffold

Prefer the non-interactive form when both names are known:

```bash
harbor adapter init <adapter-name> --name "<Human-Readable Name>"
```

Otherwise run `harbor adapter init` interactively and let the CLI prompt.

Expected output: a new directory at `adapters/<adapter-name>/` containing `pyproject.toml`, `README.md`, `src/<adapter_name>/`, and the template task files under `src/<adapter_name>/task-template/`. Verify the directory exists before continuing.

### 5. Hand off to the tutorial

Continue from "Step 1. Understand the Original Benchmark" in the tutorial. Do not invent structure, field names, or workflow beyond what the guide specifies.

**High-priority gotchas** (each is documented in the tutorial, but these are the most common adapter-build failures — surface them proactively as you work through the steps):

- **Every generated `task.toml` must contain a `name` field under `[task]`.** `main.py` is responsible for deriving a sanitized, unique, registry-safe name for every task. Tasks without a `name` cannot be registered. See the tutorial's "Naming rules" table.
- **Task names must be stable across adapter runs.** Unstable names churn registry digests on republish. If upstream lacks stable identifiers, mint a deterministic scheme (e.g., `{dataset}-1`, `{dataset}-2`) from a reproducible sort.
- **Use `schema_version = "1.4"` at the top of `task.toml`.** Set package versions separately with `[task].version` in `task.toml` and `[dataset].version` in `dataset.toml`. Request any desired registry tags in the PR description.
- **`main.py` must support `--output-dir`, `--limit`, `--overwrite`, and `--task-ids`.** These flags are required for reproducible runs and task-level debugging.
- **The generated `README.md` is parsed by downstream automation.** Fill in every section exactly as the template defines; put extra context in the **Notes** section or in the `notes` fields of `parity_experiment.json` / `adapter_metadata.json`. Do not add, rename, reorder, or remove sections.
- **Do not run parity experiments unilaterally.** Tutorial Step 4 requires team coordination on agents, models, and number of runs before incurring API costs. Complete sanity checks first, and execute full runs symmetrically on both sides.

## Reference adapters by scenario

When implementation questions come up, point at an existing adapter that matches the benchmark's shape:

| Scenario | Example adapter | When to use |
|----------|----------------|-------------|
| Compatible agent already exists | `adapters/adebench/` | Upstream already supports Claude-Code / Codex / OpenHands / Gemini-CLI |
| Fork upstream + add LLM agent | `adapters/evoeval/` | LLM-based benchmark with no Harbor-compatible agent |
| Custom agent, separate dataset | `adapters/bixbench/`, `adapters/financeagent/` | Custom interaction semantics; financeagent also demos LLM-as-a-Judge |
| Custom agent in-place | `adapters/medagentbench/` | Custom HTTPAgent, no separate dataset |
| Multi-agent workflow | `adapters/cooperbench/` | Multiple agents coordinate via messaging / sidecars |
| GPU tasks | `adapters/featurebench/` | Comprehensive Docker + Modal GPU example |

## What this skill does NOT do

- Implement `adapter.py`, `main.py`, or any task-template files. Those are the contributor's work, guided by the tutorial.
- Run oracle verification or parity experiments. Those require explicit user intent and, for parity, team coordination.
- Publish the dataset or open PRs. Those are later steps in the tutorial.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `harbor: command not found` | Harbor CLI not installed | Install with `uv tool install harbor` or the repository's development setup. |
| `harbor adapter init` fails with a name validation error | Adapter name contains invalid characters | Re-run with a lowercase, hyphen-separated name. |
| Scaffold succeeds but `adapters/<name>/` is not present | Running from outside the repository root | `cd` to the Harbor repository root and re-run. |
| Oracle passes locally but parity later fails spuriously | Stale Harbor checkout | `git fetch origin && git status`; pull `main` if behind. |
