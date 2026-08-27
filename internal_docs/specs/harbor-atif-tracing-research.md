# Harbor ATIF tracing research

Research date: 2026-08-26

This note resolves the open design questions for adding `trace_mode="atif"` to
the Phoenix Harbor plugin. It uses Harbor 0.21.0, Harbor 0.22.0, Harbor main at
`74cc6312`, and Phoenix main at `822d7cbb` as primary sources.

## Conclusions

1. ATIF discovery is deterministic from each terminal `TrialResult`. The
   plugin does not need to scan the whole job directory or rebuild Harbor's job
   plan.
2. Discovery should start at each role's canonical `trajectory.json` and
   traverse continuation and subagent references. A broad
   `trajectory*.json` glob can pick up stale retry files and unrelated native
   trajectory files.
3. External subagent paths must never trigger arbitrary file or network reads.
   The plugin should resolve local references only inside the Harbor-owned
   agent log directory that contains the referring trajectory.
4. Every Phoenix experiment already owns a trace project. `project_name` is
   optional in the generated type for historical compatibility, not because
   experiments normally lack projects. A detail-fetch fallback handles old
   list responses that returned `null`.
5. Phoenix cannot currently attach a trace to a successful experiment run.
   The current POST deliberately returns 409 before changing any field. The
   smallest safe extension is a one-time trace-link enrichment in that same
   endpoint.
6. `trace_mode="atif"` should be best effort for every trace-specific failure.
   The plugin should preserve experiment runs and evaluations, warn, and retry
   trace upload or attachment during completed-job replay.
7. The local end-to-end test should use a real ATIF producer. Terminus-2 is the
   best default because Harbor implements it directly, advertises ATIF
   support, and writes the canonical files without another agent CLI.

## Artifact discovery

### What Harbor persists

`TrialResult` contains the terminal `TrialConfig`, `trial_name`, `trial_uri`,
top-level timing, and ordered `step_results`. `TrialConfig` contains
`trials_dir`, the configured agent, and the job ID. These values identify the
local trial directory as `config.trials_dir / trial_name` without parsing the
URI. [Harbor 0.21 TrialResult](https://github.com/harbor-framework/harbor/blob/v0.21.0/src/harbor/models/trial/result.py)
and [TrialConfig](https://github.com/harbor-framework/harbor/blob/v0.21.0/src/harbor/models/trial/config.py)
define those fields.

`TrialPaths` is Harbor's public path model. A single-step agent writes to
`<trial>/agent`. A multi-step trial moves or copies each step's agent output to
`<trial>/steps/<step_name>/agent`. Harbor removes empty root mount directories
after a multi-step trial. [TrialPaths](https://github.com/harbor-framework/harbor/blob/v0.21.0/src/harbor/models/trial/paths.py)
and [MultiStepTrial](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/trial/multi_step.py)
own these rules.

Harbor documents `agent/trajectory.json` as the canonical ATIF output and its
built-in ATIF agents write that name. Terminus-2 writes continuation files such
as `trajectory.cont-1.json` and external summarization trajectories beside the
main file. [Harbor's ATIF guide](https://github.com/harbor-framework/harbor/blob/v0.22.0/docs/content/docs/agents/trajectory-format.mdx)
and [Terminus-2 implementation](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/agents/terminus_2/terminus_2.py)
show the convention.

Harbor 0.22 added simulated-user trials with a second
`<trial>/user-agent` log directory. Multi-step tasks reject simulated users, so
this is a single-step-only role. [Harbor 0.22 TrialPaths](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/models/trial/paths.py)
and [simulated-user trial support](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/trial/simulated_user.py)
define it.

### Selected discovery algorithm

For each terminal result:

1. Construct `TrialPaths(config.trials_dir / trial_name)`.
2. If `step_results` is absent, inspect the primary `agent_dir`. Also inspect
   `user_agent_dir` when `config.user_agent` exists and the installed Harbor
   version exposes that path.
3. If `step_results` is present and `agent.resume_trajectory` is false, inspect
   `step_agent_dir(step_result.step_name)` in result order. This uses only
   steps Harbor actually attempted.
4. If `agent.resume_trajectory` is true, inspect only the last attempted step
   directory that contains `trajectory.json`. Harbor copies the live agent
   directory into intermediate steps while preserving it for the next step,
   so earlier directories are cumulative snapshots and would duplicate the
   final session.
5. Seed each directory with the exact `trajectory.json` path. Do not accept a
   continuation or subagent file as a root when the main file is absent.
6. Parse the root with Harbor's public `Trajectory` model.
7. Follow `continued_trajectory_ref` and local
   `subagent_trajectory_ref.trajectory_path` edges. Keep a visited canonical
   path set so cycles terminate.
8. Ignore unreferenced sibling files. They may belong to a failed retry or be
   an agent-native trajectory that happens to use a similar name.

This is more accurate than Harbor's current training-export utility. That
utility follows continuation references for the main conversation but globs
`trajectory.*.json` for subagents and handles only the root `agent` directory.
It is useful evidence for the naming convention, but it is not a reusable
multi-step plugin API. [Harbor trace exporter](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/utils/traces_utils.py)
contains that logic.

### Agent capability is advisory

`BaseAgent.SUPPORTS_ATIF` is false by default and built-in ATIF producers set
it to true. Harbor's own trace exporter resolves the built-in class through
`AgentFactory` and rejects agents without the flag. [BaseAgent](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/agents/base.py),
[AgentFactory](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/agents/factory.py),
and the [trace exporter](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/utils/traces_utils.py)
show this behavior.

The Phoenix plugin should use the flag only to improve warning text. The file
and Harbor `Trajectory` validation decide whether ATIF exists. Custom agents
can write valid ATIF even if they forgot the flag, and importing arbitrary
custom agent classes only to inspect a class variable can load optional
dependencies or execute import-time code.

The `Job` passed to a plugin still does not expose its exact resolved
`JobPlan`. Rebuilding it is unsafe for resume. This is tracked in
[Harbor issue #2707](https://github.com/harbor-framework/harbor/issues/2707).
Trace discovery does not need that missing API because the terminal
`TrialResult` contains the persisted trial config and executed step names.

## Continuation and subagent paths

### ATIF semantics

ATIF v1.7 has two subagent reference forms:

- embedded references match `trajectory_id` against an entry in the parent's
  `subagent_trajectories` array;
- external references use `trajectory_path`, which may describe a file, URL,
  object-store location, or another external identifier.

`session_id` is informational and may collide across sibling subagents. It is
not a resolution key. Harbor's
[SubagentTrajectoryRef model](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/models/trajectories/subagent_trajectory_ref.py)
states these rules, and its
[Trajectory model](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/models/trajectories/trajectory.py)
requires unique IDs for embedded children.

Terminus-2's external form writes the child beside the parent and stores only
the basename in `trajectory_path`. Its continuation reference also stores a
basename. This establishes the practical local rule: resolve a relative edge
against the referring trajectory's directory.
[Terminus-2](https://github.com/harbor-framework/harbor/blob/v0.22.0/src/harbor/agents/terminus_2/terminus_2.py)
implements both forms.

### Safe local resolution

The plugin should not fetch URLs, S3 objects, database references, or files
outside the role's agent directory. An ATIF file is agent-controlled input, so
following an arbitrary absolute path would create a host-file disclosure bug.

For every path edge:

1. Reject URI schemes for local discovery.
2. Resolve a relative path against the referring file's parent.
3. Canonicalize the target, including symlinks.
4. Require the canonical target to remain below the canonical agent directory.
5. Require a regular JSON file.
6. Parse it with Harbor `Trajectory` before following its edges.

If a reference is remote or outside the allowed directory, keep the parent
trajectory, warn that the external child was not imported, and let the common
Harbor trial root adopt any otherwise orphaned subtree. If a local reference
claims to point inside the role directory but is missing or invalid, warn and
skip that branch. Since ATIF mode is best effort, neither case should suppress
the experiment run or its evaluations.

For a resolved external child, assign the child a deterministic synthetic
trajectory ID and rewrite the copied parent's reference to that ID before
calling the Phoenix converter. Retain `trajectory_path` and producer IDs in
metadata for provenance. Embedded references already resolve by ID; rewrite
both the embedded child ID and its matching copied reference together.

## Phoenix experiment projects

Every experiment creates or selects a Phoenix trace project and stores its
name on the experiment row. The server returns that value from experiment
create and detail responses. [Phoenix experiment routes](https://github.com/Arize-ai/phoenix/blob/822d7cbb6ee9bc88e825888928bbb11d22a1b9d2/src/phoenix/server/api/routers/v1/experiments.py)
implement the relationship.

The generated `Experiment.project_name` remains optional because older and
legacy records may contain null. There was also a list-response bug that
returned null unconditionally until August 2025. Phoenix fixed it in 11.23.1.
[Fix #9077](https://github.com/Arize-ai/phoenix/commit/766fd3f0d44083211bacb15d8f70c22892668009)
changed the list route to return the stored value.

A June 2026 change added the ability for callers to choose a shared project
name. That is separate from returning an experiment's automatically generated
project. The Harbor integration does not need a configurable project name.
[Phoenix commit 0a697af](https://github.com/Arize-ai/phoenix/commit/0a697af588eabcb4cf894fffb14e14d90ce2a9e3)
documents the distinction.

Selected behavior:

- retain `project_name` from experiment creation or listing;
- when a recovered list item has no project name, call the existing experiment
  detail endpoint and use its value;
- if detail also returns null, warn and record untraced rather than failing the
  Harbor trial;
- never route to the default Phoenix project or invent a name.

This adds no project-name-specific server floor for the common case.

## Attaching a trace to an existing successful run

### Current behavior

Phoenix's experiment-run POST looks up the unique
`(experiment, dataset_example, repetition)` record. If a matching run has no
error, it returns 409 before applying any update. Failed runs are upsertable.
There is no REST or Python client method that patches a run's trace ID.
[Experiment run route](https://github.com/Arize-ai/phoenix/blob/822d7cbb6ee9bc88e825888928bbb11d22a1b9d2/src/phoenix/server/api/routers/v1/experiment_runs.py)
and the [Python `log_run` method](https://github.com/Arize-ai/phoenix/blob/822d7cbb6ee9bc88e825888928bbb11d22a1b9d2/packages/phoenix-client/src/phoenix/client/resources/experiments/__init__.py)
enforce that rule.

The database can store the association. `ExperimentRun.trace_id` is a nullable
column related to `Trace.trace_id`, but the relationship is not exposed as an
update operation. Trace IDs are globally unique in Phoenix.
[Phoenix database models](https://github.com/Arize-ai/phoenix/blob/822d7cbb6ee9bc88e825888928bbb11d22a1b9d2/src/phoenix/db/models.py)
define those constraints.

### Selected server change

Extend the existing experiment-run POST with one narrow exception to successful
run immutability:

- stored trace ID is null and the request supplies a trace ID: verify that the
  trace exists in the experiment's project, set only `trace_id`, and return the
  existing run ID;
- stored trace ID equals the request trace ID: return the existing run ID as an
  idempotent success;
- stored trace ID differs: return 409;
- the request supplies no trace ID: preserve the current 409 behavior;
- never update output, error, timing, example, experiment, or repetition on a
  successful run.

This reuses `AsyncClient.experiments.log_run` and its existing request type. A
new general PATCH endpoint would add API without giving the plugin more useful
behavior. A delete-and-recreate workaround would break run IDs and attached
evaluations, so it is not acceptable.

The plugin uploads and confirms the trace before reposting the run. A Phoenix
server released before this conditional update will still return 409. In that
case, the plugin warns that backfill requires a newer server and leaves the
existing run unchanged. Fresh runs remain compatible because their initial
POST already accepts `trace_id`.

## Best-effort failure policy

Tracing is supplemental to the experiment result. The LangSmith Harbor plugin
also defaults to non-fail-fast behavior for observability errors, while
offering explicit strict behavior through `fail_fast`.
[LangSmithPlugin](https://github.com/harbor-framework/harbor/blob/74cc6312018c349c6bd2400c89a0ac4983ac1085/packages/harbor-langsmith/src/harbor_langsmith/plugin.py)
is the closest first-party plugin precedent.

For this stage, do not add a strict option. `trace_mode="atif"` behaves as
follows:

- no root ATIF file: warn, then record or reuse the untraced run;
- non-ATIF `trajectory.json`: warn that the agent produced no ATIF, then record
  untraced;
- invalid ATIF or broken local reference: warn with the trial-relative path,
  skip the invalid document or branch, and upload any valid connected portion;
- no valid root after validation: record untraced;
- conversion, project lookup, upload, persistence, or attachment error: warn,
  record or retain the untraced run, and continue evaluations;
- trace ID conflict on an already linked run: warn and retain the first link;
- resume: rebuild the same deterministic trace, fill missing spans, and retry
  the one-time attachment.

Warnings must include job ID, trial ID, task, repetition, stage, and source
path when one exists. They must not include API keys or raw trajectory content.

## Replay and ambiguous uploads

Phoenix validates duplicate span IDs against spans already in the database,
then queues the whole accepted request asynchronously. A span can therefore be
accepted but not yet visible to a following query. The create-spans endpoint
rejects a request atomically if it sees any stored duplicate.
[Create spans route](https://github.com/Arize-ai/phoenix/blob/822d7cbb6ee9bc88e825888928bbb11d22a1b9d2/src/phoenix/server/api/routers/v1/spans.py)
and [client span resource](https://github.com/Arize-ai/phoenix/blob/822d7cbb6ee9bc88e825888928bbb11d22a1b9d2/packages/phoenix-client/src/phoenix/client/resources/spans/__init__.py)
define those semantics.

Replay should:

1. Query the deterministic trace ID in the experiment project.
2. Reject the candidate trace in memory if stored IDs exist outside the
   expected set.
3. Upload only expected IDs not yet visible.
4. If the POST reports duplicates, query again instead of treating the error
   as a collision immediately. A prior accepted request may have become
   visible between preflight and POST.
5. Poll until the stored set equals the expected set or the deadline expires.
6. Attach only after exact-set confirmation.
7. On timeout or conflict, warn and leave the run untraced. Resume retries.

## Real-agent end-to-end test

Use Terminus-2 with a real model call and one repetition of a small multi-step
task. Harbor documents Terminus-2 as an ATIF producer and shows OpenAI and
Anthropic model invocations. [Terminus-2 docs](https://github.com/harbor-framework/harbor/blob/v0.22.0/docs/content/docs/agents/terminus-2.mdx)
are the source for the invocation.

The most useful sequence costs only one agent execution:

1. Run Terminus-2 with `trace_mode=none`. Assert Harbor wrote valid ATIF and
   Phoenix stored an untraced experiment run.
2. Reinvoke the completed Harbor job with `trace_mode=atif`. Harbor performs no
   trial compute; the plugin converts the persisted ATIF, uploads it, and
   attaches it to the same run.
3. Reinvoke once more with ATIF enabled. Assert no duplicate experiment, run,
   evaluation, trace, or span records.

Use an environment template such as `OPENAI_API_KEY=${OPENAI_API_KEY}` when
passing the credential to Harbor. Harbor 0.21 already resolves templates from
the host and serializes sensitive values back as templates rather than secret
text. [Harbor environment helpers](https://github.com/harbor-framework/harbor/blob/v0.21.0/src/harbor/utils/env.py)
implement this behavior.

Keep the existing `HARBOR_VERSION` override. Contract tests should cover the
minimum supported Harbor 0.21.0, while the real local E2E should default to the
latest supported stable Harbor release, currently 0.22.0. The E2E is local and
credentialed, not CI-gated.

## Edge-case assessment

| Case | Likelihood | Handling |
| --- | --- | --- |
| ATIF-capable agent writes one valid root | Very high | Convert and attach one trial trace |
| Agent does not support ATIF or fails before writing | High | Warn and keep an untraced run |
| Multi-step task without resume | High for this project | Traverse each attempted step directory in result order |
| Existing successful untraced run | High during rollout | Upload, then use the one-time trace attachment behavior |
| Constant or missing session and trajectory IDs | High across built-in agents | Namespace copied IDs by Harbor job, trial, role, step, and document |
| Upload accepted but not yet queryable | Medium | Poll, and treat duplicate POST responses as possible prior acceptance |
| Retry leaves stale sibling files | Medium | Follow the current root's graph; ignore unreferenced siblings |
| Multi-step native session resume | Medium | Use the last attempted cumulative snapshot only |
| Continuation chain | Medium | Follow `continued_trajectory_ref` with cycle detection |
| Local external subagent file | Medium for Terminus-2 | Resolve below the referring agent directory and rewrite the copied ref |
| Invalid or truncated ATIF | Medium on agent failure | Warn, salvage valid roots or branches, and keep the run |
| Agent log include/exclude filters omit ATIF | Medium for remote jobs | Warn that no local root was retained |
| Regrade job copies a source trajectory | Low to medium | Treat copied ATIF as the regrade run's trace with a new deterministic trace ID |
| Simulated-user trajectory | Low today | Include primary and user-agent roots under the trial CHAIN root |
| Remote subagent URL or path outside trial | Low | Never fetch or read it; warn and keep the local trace portion |
| Symlink escape or path traversal | Low but security-sensitive | Canonicalize and reject targets outside the role directory |
| Reference cycle | Low | Stop at the visited canonical path set |
| Existing run linked to another trace | Low but integrity-sensitive | Keep first link and warn; never replace it |
| Very large trajectory | Low today | Use existing endpoint once; defer chunking until measurements justify it |
| ATIF v1.8 audio on Harbor main | Near-term compatibility risk | Add the small forward-compatible converter mapping in this stage; do not cap Harbor |
| Local image or audio file references | Low | Preserve path, MIME type, and audio duration as metadata; binary media upload is out of scope |

Harbor main added ATIF v1.8 audio after the 0.22.0 release. Phoenix already
accepts unknown ATIF v1.x minor versions with a warning and preserves the raw
content array in `input.value`, but the current string and flattened content
attribute builders only retain image sources. Because the Phoenix package
accepts Harbor `>=0.21.0` without an upper bound, this stage should make the
small forward-compatible converter update instead of imposing a temporary
dependency cap: stringify audio as an audio placeholder and retain its path,
MIME type, and optional duration in metadata/raw message JSON. There is no
standard OpenInference audio content-part URL field in the conventions used by
this converter, so inventing one is out of scope. Binary media upload is also
out of scope. [Harbor main ATIF model](https://github.com/harbor-framework/harbor/blob/74cc6312018c349c6bd2400c89a0ac4983ac1085/src/harbor/models/trajectories/trajectory.py)
shows the new schema version.
