---
name: phoenix-harbor
description: Configure and interpret the Phoenix plugin for Harbor agent evaluations. Use when adding `arize-phoenix` to Harbor jobs, choosing ATIF tracing, mapping Harbor tasks and rewards to Phoenix experiments, comparing agents or models, resuming jobs, or troubleshooting Harbor records in Phoenix.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
---

# Phoenix for Harbor

Use the Phoenix Harbor plugin to record Harbor agent evaluations as versioned Phoenix datasets, experiments, runs, scores, and ATIF traces.

Harbor runs agents and verifiers. Phoenix records and compares their results. Do not describe Phoenix as executing Harbor tasks or recalculating Harbor rewards.

## Requirements

- Python 3.12 or newer
- Harbor 0.21.0 or newer
- `arize-phoenix-client` installed with the `harbor` extra
- Phoenix server 15.0 or newer

Install the client and Harbor in the same Python environment:

```bash
pip install "arize-phoenix-client[harbor]"
```

## Choose the trace mode

Use `atif` unless the agent has no ATIF trajectory or the user does not want traces. ATIF is the default. It reads trajectory files after the final trial attempt, so the sandbox needs no Phoenix endpoint, credentials, instrumentation, or outbound network access.

Use `none` to record datasets, experiments, runs, and evaluations without traces:

```bash
--plugin-kwarg trace_mode=none
```

Live OpenTelemetry Protocol (OTLP) support is deferred to a follow-up. This release accepts only `atif` and `none`, and does not link live OpenTelemetry agent traces to experiment runs.

## Set the Phoenix destination

Set the endpoint for the Phoenix plugin process. ATIF agents and their sandboxes do not connect to Phoenix. Prefer environment variables so credentials do not enter shell history or job configuration:

```bash
export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
export PHOENIX_API_KEY=your-api-key
```

Omit `PHOENIX_API_KEY` when the Phoenix instance does not require authentication. The `endpoint` and `api_key` plugin kwargs override these values when the user asks for per-job settings.

## Add the plugin

Add `--plugin arize-phoenix` to the user's existing `harbor run` command. Preserve their dataset, agent, model, environment, concurrency, retry, and task selections.

```bash
harbor run \
  -d terminal-bench/terminal-bench-2 \
  -a terminus-2 \
  -m openai/gpt-5-mini \
  --plugin arize-phoenix \
  --yes
```

Do not invent or replace Harbor settings that are unrelated to Phoenix.

## Predict the Phoenix records

Use this mapping when explaining a job or checking its results:

| Harbor | Phoenix |
| --- | --- |
| One task collection | One versioned dataset |
| One task | One dataset example |
| One distinct agent and model configuration | One experiment |
| One planned task attempt | One repetition |
| One final logical trial | One experiment run |
| Final verifier reward | Experiment evaluation with the original key and CODE annotator kind |
| Step verifier reward | Evaluation named `<step_name>.<reward_key>` |
| Trial or step exception | Run error and `infra_ok=0` |
| Saved ATIF trajectories | One trace linked to the run |

Each single-step or multi-step Harbor task becomes one Phoenix dataset example. A multi-step example input includes its ordered step names and instructions. Phoenix examples keep `output` empty because Harbor verifies the environment state rather than a single reference response.

The plugin records only the terminal physical attempt for a logical trial. An attempt that Harbor will retry does not create a Phoenix run. Completion order does not define repetition numbers.

## Name the dataset

The plugin infers a Phoenix dataset name for each supported single-source job. Provide `dataset=<name>` only when a job contains several direct tasks, which have no shared collection name, or when you want to customize the dataset's display name in Phoenix.

The inferred names are:

| Harbor source | Phoenix dataset name |
| --- | --- |
| Named registry dataset | The selected dataset name |
| Published package | The selected `<organization>/<dataset>` name |
| Local dataset path | The resolved directory name |
| Repository dataset | The resolved registry metadata name |
| One direct task | `harbor-task/<task-name>` |

To name several direct tasks or override an inferred name, add this setting to the Harbor command:

```bash
--plugin-kwarg dataset=release-candidate-tasks
```

Stop and explain the constraint if the job has any unsupported source shape:

- more than one configured dataset;
- both a configured dataset and direct tasks;
- several direct tasks without `dataset=<name>`;
- duplicate task IDs; or
- a regrade job or another job derived from previous Harbor results.

The plugin synchronizes the complete resolved task set at job start. An unchanged set reuses the dataset version. A task addition, removal, or content change creates a version. Existing experiments stay pinned to their creation-time version.

## Name experiments

The default template is:

```text
{job.name} · {agent.name} · {agent.model}
```

For one agent configuration, an exact name is valid:

```bash
--plugin-kwarg experiment_name=release-candidate
```

For several agent configurations, use `experiment_name_template`. Available fields are:

- `{job.name}`
- `{job.id}`
- `{dataset.name}`
- `{agent.name}`
- `{agent.model}`
- `{agent.short_digest}`

Agent names do not need to be unique. Two agents with the same name but different effective configurations each get an experiment. If rendered names collide, the plugin appends the short agent digest. Stable identity comes from the Harbor job ID and effective agent configuration, not the display name.

## Interpret scores

Keep behavioral outcomes separate from execution health. Phoenix does not run another evaluator. The plugin records Harbor's completed verifier rewards as named experiment evaluations with the CODE annotator kind.

| Evaluation | Interpretation |
| --- | --- |
| `reward` | Present only when the final Harbor verifier emits a literal `reward` key. A value of `0` is behavioral failure, not an infrastructure error. |
| `infra_ok` | Present on every run. `1` means Harbor recorded no trial or step exception. `0` means at least one exception occurred. |
| `<reward_key>` | A task-specific final-verifier score in its original numeric scale. |
| `<step_name>.<reward_key>` | A task-specific step score for multi-step diagnosis. |

Do not infer `reward` from another lone key. Check its coverage before computing cross-task summaries.

A run may contain rewards and still have `infra_ok=0`. Harbor can produce verifier output before or alongside a step exception. Preserve both facts when explaining the result.

For comparisons:

1. Check the fraction of runs with `reward`.
2. Compare `reward` among behaviorally completed runs.
3. Compare `infra_ok` to find environment, timeout, agent-process, or verifier reliability problems.
4. Use step scores and the linked trace to locate the failure within a task.

## Interpret ATIF traces

One logical trial maps to one trace and one Phoenix session. The trace starts with a plugin-owned `harbor.trial` CHAIN span:

```text
harbor.trial                         CHAIN
  agent trajectory                  AGENT
    turn                            AGENT
      fresh ATIF operation          CHAIN
        model call                  LLM
        tool call                   TOOL
          referenced subagent       AGENT
```

The converter keeps fresh operations, model calls, tool calls, continuations, and referenced subagents. Copied user or system context remains in LLM messages and does not become duplicate execution spans. All steps of a multi-step task share one trial root.

ATIF timestamps are point events. Zero-duration LLM or TOOL spans can mean no unambiguous duration was available. Do not interpret them as proof that the operation took no time. Declared tool order does not prove serial execution.

ATIF discovery and conversion are best-effort. If the trajectory is missing or invalid, the plugin warns and records the run without a trace. A later replay cannot attach a trace to an immutable successful run.

## Handle failures and resume

Selecting the plugin makes successful Phoenix recording required.

- Setup failures stop the job before trials run.
- Run or evaluation write failures stop the job. Already recorded trials remain in Phoenix.
- Harbor keeps terminal results that the plugin can ingest during resume.
- ATIF conversion or upload failure does not stop the job. The run is recorded without a trace.

Sequential resume and replay reuse matching datasets, experiments, successful runs, evaluations, and traces. Failed runs can be retried. Do not run multiple ingesters for the same Harbor job because experiment recovery is not atomic across processes.

If Phoenix reports a conflict, do not tell the user to ignore it. The plugin validates the stored run's trial output and trace identity. A mismatch requires a new Harbor job or resolution of the conflicting Phoenix record.

## Current boundaries

The plugin does not support:

- Harbor regrade jobs and other jobs derived from previous Harbor results;
- post-hoc ingestion of a completed job;
- live OTLP trace linkage, which is deferred to a follow-up;
- several configured datasets in one job;
- mixed configured datasets and direct tasks; or
- concurrent ingestion of one Harbor job.

For the public guide, use [Phoenix's Harbor documentation](https://arize.com/docs/phoenix/integrations/evaluation-integrations/harbor). For Harbor command and task configuration, use the [Harbor documentation](https://harborframework.com/docs/).
