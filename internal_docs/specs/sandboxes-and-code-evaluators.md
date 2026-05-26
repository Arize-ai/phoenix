# Sandboxes and Code Evaluators

## Table of Contents

| # | Section | Focus |
|---|---------|-------|
| 1 | [Executive Summary](#executive-summary) | What we built and why |
| 2 | [Architecture](#architecture) | Adapters, session manager, runner |
| 3 | [Data Model](#data-model) | Schema and discriminated unions |
| 4 | [Sandbox Backends](#sandbox-backends) | Six adapters and their trade-offs |
| 5 | [Session Manager](#session-manager) | Pooling, eviction, rebind |
| 6 | [Code Evaluator Runner](#code-evaluator-runner) | Harness, fenced protocol, tracing |
| 7 | [Design Decisions](#design-decisions) | Major design choices and rationale |
| 8 | [Security & Isolation](#security--isolation) | Secrets, redaction, SSRF, allowlist |
| 9 | [Caveats](#caveats) | Per-backend quirks and known limits |
| 10 | [Future Considerations](#future-considerations) | What we deferred |
| — | [Appendix: Key Constants](#appendix-key-constants) | Configuration values |
| — | [Appendix: File References](#appendix-file-references) | Where things live |

---

## Executive Summary

### What We Built

Two interlocking features shipped together in [#13290](https://github.com/Arize-ai/phoenix/pull/13290) (merged 2026-05-21):

**Code Evaluators** — A new evaluator kind alongside `LLM` and `BUILTIN`. Users author an `evaluate(...)` function in Python or TypeScript directly in the Phoenix UI, attach it to a dataset, and Phoenix runs it to score and label experiment runs. Every save is versioned, executions are traced as OpenInference spans, and the same authoring surface supports a dry-run preview against a real dataset example.

**Sandboxes** — An isolated runtime layer that executes evaluator code on demand. Six backends ship: two **local** (WASM for Python, Deno for TypeScript) that require no credentials, and four **hosted** (E2B, Daytona, Vercel, Modal) that run each invocation on a provider's infrastructure. A Settings page lets administrators enable providers, store credentials encrypted at rest, and bundle them into named, reusable configurations.

Both features are **GraphQL-only** today: sandbox provider / config CRUD, code evaluator CRUD, and version history are all exposed via Strawberry mutations and queries. There are no REST endpoints under `routers/v1/` and no helpers in the Python or TypeScript clients yet.

### Why We Built It

LLM-as-judge evaluators are flexible but non-deterministic, expensive, and weak at narrow checks (regex, JSON-diff, scoring formulas). Customers wanted **deterministic** evaluators with the ability to import their own libraries or call external APIs, but writing a Python SDK loop locally is friction we wanted to eliminate. We wanted the same edit-save-run loop as LLM evaluators: author in the Phoenix UI, dry-run, attach to a dataset, debug as a span.

Running arbitrary user code on the Phoenix server is unsafe — it would have access to the filesystem, the database, customer secrets, and outbound network. The sandbox layer is the price of admission for code evaluators.

### Key Files

| File | Purpose |
|------|---------|
| [src/phoenix/server/sandbox/](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/) | Adapter registry, six backends, session manager |
| [src/phoenix/server/sandbox/types.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/types.py) | Config / credential / deployment models, capability mixins |
| [src/phoenix/server/sandbox/session_manager.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/session_manager.py) | Session pooling, TTL eviction, rebind |
| [src/phoenix/server/api/evaluators.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/evaluators.py) | `CodeEvaluatorRunner`, fenced result protocol |
| [src/phoenix/server/api/mutations/sandbox_config_mutations.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/mutations/sandbox_config_mutations.py) | Provider / config CRUD |
| [src/phoenix/server/api/mutations/evaluator_mutations.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/mutations/evaluator_mutations.py) | Code evaluator + version CRUD |
| [src/phoenix/db/migrations/versions/0ff41b5b118f_add_sandbox_and_code_evaluator_support.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/db/migrations/versions/0ff41b5b118f_add_sandbox_and_code_evaluator_support.py) | Schema |
| [app/src/pages/settings/sandboxes/](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/) | Settings → Sandboxes UI |
| [app/src/components/evaluators/EditCodeEvaluatorDialogContent.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/components/evaluators/EditCodeEvaluatorDialogContent.tsx) | CodeMirror authoring dialog |

---

## Architecture

### Three Concepts

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   SandboxAdapter (one per backend type)                                         │
│   ════════════════════════════════════                                          │
│   • Class-level metadata (display name, hosting type, capability mixins)        │
│   • Pydantic config / credentials / deployment models                           │
│   • probe_dependencies() — optional SDK import check at startup                 │
│   • build_backend(config, credentials, deployment, user_env) → SandboxBackend   │
│   • Registered iff its optional SDK is importable                               │
│   • Filtered at read-time by PHOENIX_ALLOWED_SANDBOX_PROVIDERS                  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   SandboxBackend (one per (backend_type, sandbox_config_id) per resolution)     │
│   ══════════════════════════════════════════════════════════════════════        │
│   • find_or_create_session(session_key) → opaque handle                         │
│   • execute_in_session(handle, code, timeout) → ExecutionResult                 │
│   • close_session(session_key) — idempotent teardown                            │
│   • config_fingerprint() — short digest for "did the runtime change?"           │
│   • is_session_gone(exc) — classify rebind-recoverable failures                 │
│   • Stateless backends (WASM, Deno) extend BaseNoSessionBackend                 │
│   • Cached per-batch so evaluators sharing a config share the backend object    │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   CodeEvaluatorRunner (one per evaluator, loaded with latest version source)    │
│   ════════════════════════════════════════════════════════════                  │
│   • Wraps source code in a language-specific harness                            │
│   • Applies InputMapping (literal + JSONPath) to produce kwargs                 │
│   • Executes via session manager (managed path) or direct (ephemeral path)      │
│   • Parses fenced ===PHOENIX_RESULT_BEGIN/END=== output                         │
│   • Maps result onto output configs (categorical, continuous, freeform)         │
│   • Emits OpenInference spans (evaluator → input mapping → sandbox)             │
│   • Masks provider credentials and user env-var values from spans               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
                  ┌──────────────┐
                  │ SandboxConfig│
                  │  (admin-     │
                  │   managed    │
                  │   preset)    │
                  └──────┬───────┘
                         │ read at execute time
                         ▼
┌──────────┐  build  ┌─────────────┐  acquire  ┌──────────────────┐
│ Adapter  │────────▶│  Sandbox    │──────────▶│  Session Manager │
│ Registry │         │  Backend    │           │  (composite key) │
└──────────┘         └─────┬───────┘           └────────┬─────────┘
                           │                            │
                           │ execute_in_session         │
                           ▼                            │
                  ┌──────────────────┐                  │
                  │  Code Evaluator  │◀─────────────────┘
                  │     Runner       │  SandboxSession.execute(code)
                  │ (harness + fence │
                  │   parser)        │
                  └─────┬────────────┘
                        │ EvaluationResult
                        ▼
                  ┌─────────────┐
                  │ Annotations │
                  │   on runs   │
                  └─────────────┘

Tracing flow (mirrors the LLM evaluator span tree):
  Evaluator: <name>          (kind=evaluator, input=context)
  ├── Input Mapping          (kind=chain, output=mapped kwargs)
  └── Sandbox: <name>        (kind=tool, input=mapped kwargs, output=parsed result)
```

---

## Data Model

Migration `0ff41b5b118f` creates four new tables (`languages`, `sandbox_providers`, `sandbox_configs`, `code_evaluator_code_versions`) and alters the existing `code_evaluators` table to add `language`, `sandbox_config_id`, `input_mapping`, and `output_configs` columns plus the composite FK.

### `languages`

A two-row dictionary table seeded with `('PYTHON')` and `('TYPESCRIPT')`. Exists so other tables can take a FK on language values without committing to a CHECK constraint.

### `sandbox_providers`

Admin-scoped row, **one per backend type**. `backend_type` is the primary key.

| Column | Type | Purpose |
|--------|------|---------|
| `backend_type` | string (PK) | `WASM`, `E2B`, `DAYTONA`, `VERCEL`, `DENO`, `MODAL` |
| `enabled` | boolean | Master kill-switch per backend |
| `config` | JSON | Deployment routing (E2B domain, Daytona target, etc.) |
| `user_id` | int? (FK) | Who last touched it; SET NULL on user delete |
| `updated_at` | timestamp | Last update |

Credentials are **not** in this table — they live in the existing `secrets` table, keyed by the credential's field name (e.g. `E2B_API_KEY`). The provider row exists even when disabled or unconfigured, so the Settings UI always has something to display.

### `sandbox_configs`

Admin-managed presets, **many per provider**. A config bundles a language, a timeout, dependencies, env-var references, and an internet-access toggle into a named preset that evaluator authors pick from. Creation and editing are gated by `IsAdminIfAuthEnabled`; members can select an existing config when authoring an evaluator but cannot create one.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | int (PK) | |
| `backend_type` | string (FK→sandbox_providers, RESTRICT) | |
| `language` | string (FK→languages, RESTRICT) | |
| `name` | identifier (UNIQUE per `backend_type`) | |
| `description` | string? | |
| `config` | JSON | Language-specific Pydantic config blob |
| `timeout` | int | Per-execute timeout in seconds |
| `enabled` | boolean | Per-config kill-switch |
| `user_id` | int? (FK) | Who last touched it; SET NULL on user delete |

The composite `UNIQUE (language, id)` is **not** for dedup — it exists so `code_evaluators` can take a composite FK on `(sandbox_config_id, language)`, guaranteeing an evaluator and its sandbox config can never disagree on language.

### `code_evaluators`

Polymorphic subclass of `evaluators` (`kind='CODE'`).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | int (PK, FK→evaluators.id CASCADE) | |
| `kind` | `'CODE'` (CHECK constraint) | |
| `language` | string (FK→languages) | |
| `sandbox_config_id` | int? (FK→sandbox_configs, SET NULL) | Nullable: an evaluator can outlive its sandbox |
| `input_mapping` | JSON | `{literal_mapping: {}, path_mapping: {}}` |
| `output_configs` | JSON | List of categorical / continuous / freeform configs |

Composite FK `(sandbox_config_id, language) → (sandbox_configs.id, sandbox_configs.language)` enforces language agreement.

### `code_evaluator_code_versions`

Source code is **not** stored on `code_evaluators`. Every save creates a new row here.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | int (PK) | Auto-increment; ordering is by `id` |
| `code_evaluator_id` | int (FK→code_evaluators, CASCADE) | |
| `user_id` | int? (FK→users, SET NULL) | Who saved it |
| `source_code` | string | The code |
| `created_at` | timestamp | |

Index `(code_evaluator_id, id)` makes "latest version per evaluator" cheap. The "current" version is the row with the largest `id` for a given `code_evaluator_id` — there is no explicit current-version pointer.

---

## Sandbox Backends

Six adapters ship in [src/phoenix/server/sandbox/](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/). Each is a small `SandboxAdapter` subclass paired with a Pydantic `Config`, `Credentials`, and `Deployment` model.

| Backend | Languages | Hosting | Env Vars | Internet | Deps | Session Reuse |
|---------|-----------|---------|----------|----------|------|---------------|
| **WASM** | Python | Local | ❌ | ❌ | ❌ | Stateless |
| **Deno** | TypeScript | Local | ❌ | ❌ | ❌ | Stateless |
| **E2B** | Python | Hosted | ✅ | ✅ (boolean) | ✅ (runtime) | ✅ (by metadata) |
| **Daytona** | Python, TS | Hosted | ✅ | ✅ (boolean) | ✅ (runtime) | ✅ (by metadata) |
| **Vercel** | Python, TS | Hosted | ✅ | ✅ (boolean) | ✅ (runtime) | ⚠️ partitioned by replica |
| **Modal** | Python | Hosted | ✅ | ✅ (boolean) | ✅ (build time) | ✅ (by name) |

Capability advertisement is structural: an adapter's config model composes mixins (`SupportsEnvVars`, `SupportsInternetAccess`, `SupportsDependencies`, `_RuntimePackageInstallation`) and the metadata layer derives the capability flags from `issubclass()` checks. This means the wire format is the source of truth — adding `SupportsEnvVars` to a config automatically advertises env-var support to the GraphQL layer and the UI.

### Local Backends

**WASM** runs CPython 3.12 compiled to WebAssembly inside the Phoenix process via `wasmtime`. Each guest instance is capped at 128 MiB of linear memory (`_MAX_WASM_MEMORY_BYTES`), with bounded captured stdout, no network, and no filesystem access. The binary is pre-fetched at server startup (`_download.py`) with an integrity check, so the first evaluator run doesn't pay a download cost. A thread pool with 4 workers runs WASM instances off the event loop, so the worst-case host footprint is 4×128 MiB of guest memory plus the shared Wasmtime engine/module cache.

**Deno** spawns a `deno run` subprocess with explicit lockdown flags (`--no-prompt --no-config --no-remote --no-npm`) and no `--allow-*` permissions granted (default-deny: no read, write, env, net, ffi, run, sys, or hrtime). The subprocess inherits an **empty environment** — no leakage of Phoenix's process env into user code. Bounded concurrent subprocesses (4). No env vars by design: the only safe way to pass values would re-introduce environment exposure.

### Hosted Backends

The session key used in production (see [Session Manager](#session-manager) below) includes the manager's `replica_id`, so **all hosted backends are replica-isolated by construction** — two replicas with the "same" evaluator + experiment never converge on the same remote sandbox. The per-backend notes below describe how the backend behaves *within* a single replica.

**E2B** uses E2B's `AsyncSandbox`. The manager finds existing sandboxes by metadata, so successive runs of the same `(evaluator, experiment)` pair on the same replica reuse the warm sandbox. Cross-replica reuse is deliberately blocked by the replica-partitioned key.

**Daytona** is structurally similar to E2B (long-lived workspaces, found by metadata) but supports both Python and TypeScript. On-prem deployments route via `api_url`/`target` set on the provider row.

**Vercel** uses Vercel Functions. Vercel's `AsyncSandbox.create` has no public stable-id parameter today — even *within* a replica there is no metadata-based "find existing"; the manager's local tracking is the only thing that prevents duplicate creates. The replica partitioning in the session key is what keeps two replicas from racing to create "the same" sandbox.

**Modal** is the odd one out: dependencies are **baked into the Image at build time**, not installed at runtime, because Modal's pricing model rewards reuse of immutable images. The adapter does **not** compose `_RuntimePackageInstallation`, so a config with `dependencies.packages` and `internet_access.mode='deny'` is *valid* for Modal even though it would be a contradiction for E2B / Daytona / Vercel.

---

## Session Manager

`SandboxSessionManager` in [session_manager.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/session_manager.py) is the central authority for pooling hosted sandbox sessions.

### Why Pool

A cold E2B / Daytona / Vercel / Modal sandbox takes seconds to spin up. An experiment with 1,000 runs × 3 evaluators = 3,000 invocations. Without pooling, a 5-second cold start times out the entire evaluator budget. The manager keeps a sandbox warm between invocations of the same logical session, so all runs of the same evaluator on the same experiment (on the same replica) hit the same warm sandbox.

### What the Manager Owns (and Doesn't)

The manager is the sole owner of pooled hosted-backend sessions and the sole shutdown authority for them: `SandboxSessionManager.stop()` overrides `DaemonTask.stop` to drain in-flight tasks and tear down every tracked entry via `close_session`. There is no separate init-layer cache holding bound backends — the manager's `_tracked` dict (keyed on `composite_key`) is the single source of truth for live sessions.

Stateless backends are explicitly out of scope. `acquire`, `evict_for_backend`, `evict_for_session_key`, and `evict_for_provider_family` all `isinstance(backend, BaseNoSessionBackend)` short-circuit, so WASM and Deno traffic bypasses the manager entirely. Adding pooling-like behavior to a future stateless backend requires moving it off `BaseNoSessionBackend` first.

### Session Key Reference

The runner builds the **logical** session key — what counts as "the same sandbox" from the system's point of view — at [evaluators.py:912](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/evaluators.py#L912):

```python
session_key = f"evaluator:{evaluator_id}:exp:{experiment_id}:{replica_id}"
```

Three independent dimensions:

| Dimension | Why it's in the key |
|-----------|--------------------|
| `evaluator_id` | Different evaluators should not share a sandbox (different deps, env, etc.) |
| `experiment_id` | Different experiments amortize their own cold start; isolates blast radius |
| `replica_id` | Concurrent runs across replicas never converge on the same provider sandbox |

Notably **not** in the key:
- **`evaluator_version_id`** — saving a new version *reuses* the warm sandbox. The new source code is sent on every call anyway (it's just a string in the harness), so version churn does not pay cold-start cost. The version ID is attached to the sandbox span as `code_evaluator_version_id` metadata for audit, but does not participate in pooling.

The session manager then composes a **physical** tracking key by appending the config fingerprint:

```python
composite_key = f"{session_key}#{config_fingerprint()}"
```

The fingerprint is a 16-char sha256 prefix over the **subset of config that affects the remote runtime**:

- `backend_type`, `language`
- `dependencies.packages` (sorted)
- `internet_access.mode`

Env-var **values** are deliberately excluded from the fingerprint — rotating an API key doesn't invalidate the warm sandbox. Note that env-var **injection lifecycle differs across backends**: E2B, Daytona, and Deno inject per-execute (so rotation takes effect on the next call), while Vercel and Modal inject at session-creation time (so a warm session holds the value it was created with until the session is dropped for an unrelated reason). WASM raises `UnsupportedOperation` — it doesn't accept env vars at all. Env-var **keys** are also excluded from the fingerprint. The composite key means a mid-iteration config change (user adds a package, toggles internet access) fragments into a fresh remote session naturally — no explicit invalidation logic.

This `composite_key` is what the manager passes to backends via `find_or_create_session` and what it uses to look up tracked entries internally.

### When Cold Starts Actually Happen

| Trigger | Cold start? |
|---------|-------------|
| First eval of an experiment | Yes (sandbox is created) |
| Subsequent evals, same evaluator + experiment + replica | No (warm reuse) |
| Saving a new evaluator version | No (key doesn't include version) |
| Different evaluator, same experiment | Yes (different `evaluator_id`) |
| Same evaluator, different experiment | Yes (different `experiment_id`) |
| Same evaluator + experiment, different replica | Yes (different `replica_id`) |
| Config change (deps / internet / language) | Yes (different `config_fingerprint`) |
| Env-var value rotation | No |
| Preview / dry-run from the authoring UI | Yes every time (ephemeral path, see [Code Evaluator Runner](#code-evaluator-runner)) |

### Lifecycle

| Knob | Value | Purpose |
|------|-------|---------|
| `idle_ttl_seconds` | 300 | Drop sessions idle longer than this |
| `sweep_interval_seconds` | 30 | How often the eviction sweeper runs |
| `eviction_grace_seconds` | 5 | Grace window before evicting a marked entry |
| `max_sessions_per_provider` | 32 | Per-provider concurrency cap |

The sweeper is a `DaemonTask` started with the server. Sessions in-flight (refcount > 0) are never evicted; idle ones past TTL are torn down via `close_session`.

> **Backend-implementer note:** `close_session` implementations MUST pop the session from any backend-local sessions dict *synchronously, before the first `await`*. The manager releases its per-key lock before awaiting `backend.close_session()`, so a backend that awaits before popping creates a race window where a concurrent `acquire` can hand out a doomed session.

### Rebind

When `SandboxSession.execute()` raises, it asks the backend to classify the exception via `is_session_gone(exc)`. If `True`, the manager calls `find_or_create_session` again (rebind), updates the handle, and retries **exactly once**. The second-attempt failure is wrapped into an `ExecutionResult` (not re-raised) — backends re-raise classified session-gone exceptions rather than wrapping them, so this distinguishes "remote sandbox died and recreate failed" from a legitimate evaluator runtime error.

Backends are expected to **under-classify**: a false-`True` triggers an unnecessary rebind, but a false-`False` surfaces a stale-session error to the user.

The rebind path reuses the existing lock-ordering discipline: `acquire` takes the per-key lock first and `_state_lock` only inside `_get_or_reserve` for short, snapshot-only critical sections; the sweeper (`_evict_matching`, `_sweep_idle`) takes `_state_lock` to snapshot the set of tracked entries and *releases it before* acquiring any per-key lock. The asymmetry is deliberate — it prevents the sweeper from waiting on a long-running `find_or_create_session` call — and any new lifecycle-mutating primitive (swap, refresh, hot-replace) should follow the same shape rather than invent a new ordering.

### Refusal Modes

Two reasons `acquire` can refuse before any backend call:

- **`SessionLimitExceeded`** — Per-provider cap hit. The runner converts this into an `EvaluationResult` with `error="session_limit_exceeded"`; the eval row is recorded but useless. This is intentional: we'd rather mark an eval as failed than let one customer starve all sandbox capacity.
- **`SessionInvalidated`** — The tracked entry is mid-drain (sweeper picked it up between `acquire` and the lock). The runner waits for the drain to complete (`wait_for_drain`) and retries once.

---

## Code Evaluator Runner

`CodeEvaluatorRunner` in [evaluators.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/evaluators.py) is the bridge between an evaluator row and the sandbox layer.

### Harness

User code defines an `evaluate(...)` function. The runner wraps it in a per-language harness that:

1. Concatenates user source.
2. Defines `_inputs = <mapped kwargs as literal>`.
3. Calls `_result = evaluate(**_inputs)` (Python) or `await evaluate(_inputs)` (TypeScript).
4. Prints `_result` as JSON between fenced markers.

Python harness:

```python
<user source>

import json as _json
_inputs = {'output': '...', 'reference': '...'}
_result = evaluate(**_inputs)
print('===PHOENIX_RESULT_BEGIN===')
print(_json.dumps(_result))
print('===PHOENIX_RESULT_END===')
```

The wire protocol is **stdout-based**, not return-value-based, because backends differ in how they surface return values from arbitrary code — but every backend has stdout. The fence is parsed by `_extract_fenced_result` which finds the last complete `BEGIN/END` pair (deliberately the *last*, so a user `print()` of fence markers earlier in the code doesn't poison the result).

### Input Mapping

`InputMapping` has two parts:

- `literal_mapping: {name: value}` — Bind a parameter to a literal.
- `path_mapping: {name: jsonpath_expr}` — Pull a value from the runtime context.

The runtime context for dataset evaluators is `{output, reference, input, metadata}`. JSONPath is evaluated via `jsonpath_ng`, so `path_mapping = {"answer": "$.output.choices[0].message.content"}` is the kind of thing that works. The runner infers the function's parameter list from the source (Python: AST; TypeScript: a regex over `function evaluate(...)` and `const evaluate = (...) =>`), so the UI knows which slots to expose in the mapping editor.

### Output Configs

The result must match one of three shapes per output config:

- **Categorical** — `{label: str, score?: float, explanation?: str}` with `label` matching a configured value.
- **Continuous** — `{score: float, explanation?: str}` within the configured min/max.
- **Freeform** — `{label?: str, score?: float, explanation?: str}` — no validation.

An evaluator can have multiple output configs; the function returns a list (or a dict) and the runner maps entries onto configs by name. Mismatches become per-config error annotations rather than a single evaluator-wide failure — this lets a partially-correct evaluator still write the configs it got right.

### Tracing

Every execution emits a three-span tree using OpenInference semantics:

| Span | Kind | Carries |
|------|------|---------|
| `Evaluator: <name>` | `evaluator` | Full context as input |
| `Input Mapping` | `chain` | Mapping spec + context as input; mapped kwargs as output |
| `Sandbox: <name>` | `tool` | Mapped kwargs as input; parsed result as output; backend / language / timeout as metadata |

OpenTelemetry auto-record is disabled on these spans (`record_exception=False, set_status_on_exception=False`) — every exception event is added explicitly via `_record_masked_exception` so we control what hits the trace.

### Two Execution Paths

The runner supports a **managed path** (production: through the session manager) and an **ephemeral path** (preview / dry-run: backend's `execute` owns the lifecycle inline). The ephemeral path exists so the test panel in the authoring UI doesn't pollute the long-lived session pool with throwaway runs.

---

## Design Decisions

### Adapter Pattern Over Hardcoded Backend Logic

**Context**: Six backends with overlapping but non-identical capability sets. Naive options: one giant `if backend_type == ...` block, or a Strategy hierarchy with abstract methods.

**Decision**: Pydantic-based adapters with capability advertisement derived from `issubclass()` checks on mixin types.

**Consequences**:
- ✅ Adding a 7th backend (e.g. CodeSandbox) is one file + one line in `_try_register_adapter`.
- ✅ The wire format *is* the source of truth — the UI's "show env-var fields" flag is derived from `issubclass(config_model, SupportsEnvVars)`. We can't have a config that says it supports env vars and an adapter that ignores them.
- ✅ Optional SDK dependencies are gated at registration. If `e2b` isn't installed, the E2B adapter is skipped and the rest of the system works.
- ⚠️ The capability matrix is implicit in mixin composition order. A reader has to look at `class E2BConfig(_Config, SupportsEnvVars, SupportsInternetAccess, SupportsDependencies, _RuntimePackageInstallation)` and translate. We accept this — it's a wider table than a Strategy hierarchy.

### Two-Tier Provider / Config Split

**Context**: An admin enables E2B (sets the API key). Three different evaluator authors want three different E2B configurations — one with `pandas`, one with internet allowed, one with neither.

**Decision**: `sandbox_providers` (one per backend) holds credentials and deployment routing. `sandbox_configs` (many per provider, admin-managed presets) holds the per-evaluator config (deps, env vars, internet access, timeout). Both are admin-gated; the split is by *scope of concern* (provider-wide vs preset-level), not by who can touch them.

**Consequences**:
- ✅ Authors don't see or touch credentials. Admins don't have to manage per-evaluator presets.
- ✅ A single backend can be disabled at the provider level (master kill-switch) without removing all configs.
- ✅ `ondelete="RESTRICT"` on `sandbox_configs.backend_type → sandbox_providers.backend_type` means an admin can't delete a provider that has configs depending on it. (Providers aren't actually deletable today; they're created lazily on first credential save.)
- ⚠️ Two layers of "enabled" booleans — both must be true for a config to be usable.

### Versioning on Every Save

**Context**: An evaluator's score on a historical experiment must be reproducible. If we mutate `source_code` in place, the experiment's annotations become unexplainable.

**Decision**: Source code lives in `code_evaluator_code_versions`, never on the evaluator row. Every save creates a new version. The `code_evaluator_version_id` is attached to each sandbox span as OpenInference metadata, so the version that produced any given annotation is recoverable via the trace.

**Consequences**:
- ✅ Full audit trail through traces. "Why did this run score 0.3?" → look up the annotation's `trace_id`, find the sandbox span, read `code_evaluator_version_id`, fetch the source.
- ✅ Rollback is just "create a new version from the source of an old one."
- ⚠️ Version is **not** a column on the annotation row — recovery goes through the trace. If trace retention drops, the audit chain breaks.
- ⚠️ Version is **not** part of the session pool key (see [Session Manager](#session-manager)), so a new save reuses the warm sandbox. This is the right trade — the new source is sent on every call anyway, and paying a cold start per save would make iterative authoring unusable.
- ⚠️ **No experiment-time version pinning.** `resolve_dataset_evaluators` always loads the *latest* version via `latest_code_evaluator_versions_by_evaluator_id` at resolve time, so re-running an experiment runs against whatever code is current, not the code that ran the original experiment. The original code is recoverable via the trace, but you can't *re-execute* against it without manually creating a new evaluator from the old source.
- ⚠️ Many rows for users who save frequently. We accept this; source code is small.

### Local + Hosted Dichotomy

**Context**: Self-hosted Phoenix users without any third-party sandbox provider should still be able to use code evaluators.

**Decision**: Two "local" backends (WASM, Deno) ship with Phoenix, need no credentials, and have intentionally limited capabilities (no env vars, no internet, no dependencies).

**Consequences**:
- ✅ Out-of-box experience: install Phoenix → use code evaluators immediately for self-contained checks.
- ✅ The local backends are the *most* locked-down — they're what we'd recommend for untrusted code regardless of admin choices.
- ⚠️ Authors who need `pandas` or to call an external API must use a hosted backend, which an admin has to enable.
- ⚠️ The WASM Python runtime is CPython 3.12 minus much of the stdlib that depends on the OS layer — some Python idioms don't work. We chose to live with this rather than pre-install dependencies into the WASM image (which would balloon binary size).

### Fenced Stdout Protocol

**Context**: How does the runner get the `evaluate()` return value back from arbitrary code running in an arbitrary backend? Backends differ — E2B can return Python objects, WASM gives you stdout, Deno gives you stdout.

**Decision**: Wrap user code in a harness that JSON-encodes the return value between sentinel markers (`===PHOENIX_RESULT_BEGIN===` / `===PHOENIX_RESULT_END===`). Parse the **last** complete pair from stdout.

**Consequences**:
- ✅ Works on every backend without per-backend deserialization logic.
- ✅ User `print()` debugging output still lands in `stderr`/stdout (outside the fence) and is visible in the sandbox span.
- ⚠️ If user code prints the marker string itself (e.g. `print("===PHOENIX_RESULT_END===")`), the parser picks the last *complete* pair — so a stray opening marker is harmless, but a stray closing marker before the real result could shift the fence boundary. The "last complete pair" rule was a deliberate choice over "first pair" specifically to be resilient to stray markers in user output.

### Three-Dimensional Session Pooling

**Context**: A warm sandbox needs a stable identity. What should it be keyed on? Too coarse (e.g. just `evaluator_id`) and two experiments fight over the same sandbox. Too fine (e.g. include `evaluator_version_id`) and every author save pays a cold start. We also need to handle two replicas running the same experiment without them stomping on each other's remote sandboxes.

**Decision**: The logical session key is `evaluator:{id}:exp:{experiment_id}:{replica_id}`. The physical tracking key appends a config fingerprint: `f"{session_key}#{config_fingerprint()}"`. The fingerprint covers `backend_type`, `language`, `dependencies.packages`, and `internet_access.mode`. Env-var values are deliberately excluded.

**Consequences**:
- ✅ Intra-experiment reuse amortizes the cold start across thousands of evals.
- ✅ Replicas never race for the same provider sandbox — each replica's pool is its own.
- ✅ Author iteration is fast: new versions hit the warm sandbox; only config changes pay cold-start.
- ✅ Config changes that affect the runtime fragment into fresh sessions automatically — no explicit "invalidate session" call needed.
- ✅ Rotating an API key (env-var value) doesn't drop the warm sandbox.
- ⚠️ No cross-replica session sharing, even on providers (E2B, Daytona, Modal) that *could* do metadata-based discovery. We chose simplicity (every replica owns its sandboxes) over the marginal capacity win.
- ⚠️ Per-experiment partitioning means a long-running experiment doesn't share its sandbox with a separate ad-hoc dry-run of the same evaluator. Acceptable — preview uses the ephemeral path anyway.

### Read-Time Provider Allowlist

**Context**: Self-hosted deployments may want to lock the feature down to a specific provider (e.g. "only Modal" because procurement approved Modal).

**Decision**: `PHOENIX_ALLOWED_SANDBOX_PROVIDERS` is a comma-separated env var. Adapters that aren't in the allowlist are filtered at **read time** from the registry, not at registration time.

**Consequences**:
- ✅ Changing the env var without a restart isn't supported (env vars are read once), but the read-time check means tests can patch the env var per-test.
- ✅ The unallowed adapter still loads its SDK and registers — so a misconfiguration shows up as `KeyError` from the registry, not a silent "where did E2B go?" mystery.
- ⚠️ Two ways to disable a backend: env var (deployment-level) or `sandbox_providers.enabled=false` (admin-level). Both are useful in different contexts; we accept the redundancy.

### Secret Masking Over Secret Stripping

**Context**: User-provided env vars and provider credentials are needed inside the sandbox but must not appear in spans, logs, or error messages.

**Decision**: `SandboxSecretMasker` is constructed from the union of all secret values for a given execution. Every string attribute on emitted spans is passed through the masker, which replaces literal occurrences of each secret with a stable `<redacted:N>` marker (one index per distinct secret, longest-first replacement order so a shorter prefix can't corrupt a longer secret's marker). Secrets shorter than 8 characters are ignored — collision rate against legitimate content is too high.

**Consequences**:
- ✅ Works for surprise leaks — if user code echoes `OPENAI_API_KEY` into stdout, the masker catches it before it lands in the sandbox span.
- ✅ Works recursively: input mapping spans, evaluator spans, exception event stack traces all run through the same masker.
- ✅ Stable `<redacted:N>` markers (rather than `***`) let an operator correlate "the same value got masked here and here" without revealing it.
- ⚠️ Mask is literal substring match. A secret that's a substring of a non-secret value over-masks. We accept this — false positives are recoverable; false negatives are a data leak.
- ⚠️ Short secrets (<8 chars) are not masked at all. Don't store short tokens.
- ⚠️ Not a substitute for not putting secrets in spans in the first place. The masker is a defense in depth.

### Catch-and-Continue on Backend Build Failures

**Context**: An optional SDK can fail to import even if it's installed (broken Python env, version mismatch). Should the daemon crash, refuse to register the backend, or surface a user-friendly error?

**Decision**: `probe_dependencies()` is called once at registration; a failed import skips registration silently (debug-logged). A *later* `ImportError` during `build_backend` is caught and surfaced as `None`, with the runner translating that into a "backend unavailable" GraphQL error to the user.

**Consequences**:
- ✅ Phoenix boots cleanly even if a sandbox SDK is broken — the rest of the system works.
- ✅ Other backends remain usable.
- ⚠️ Users see "backend unavailable" instead of the underlying import error. They have to check server logs to debug. This is the right trade — the alternative is exposing import stack traces to the UI.

---

## Security & Isolation

### Trust Boundary

User-provided code is **always untrusted**. Even the local backends are designed under the assumption that the code is hostile:

- **WASM** — no syscalls, no network, per-instance 128 MiB memory cap, capped stdout, sandboxed CPython. The sandbox can't read Phoenix's filesystem, environment, or database.
- **Deno** — empty environment, no `--allow-*` flags granted, plus `--no-prompt --no-config --no-remote --no-npm` to block interactive prompts, config-file loading, remote module resolution, and npm imports. Reading the host filesystem requires `--allow-read`; we never grant it.

Hosted backends are trust-delegated to the provider: we believe E2B / Daytona / Vercel / Modal's per-execution isolation. We control what credentials and env vars cross the boundary; we don't control what the provider does with them after that.

### SSRF Guard on Deployment URLs

Admin-configurable URLs (E2B domain / API URL, Daytona API URL) are validated against an allowlist of schemes:

- `https://` — always allowed.
- `http://localhost`, `http://127.0.0.1`, `http://::1` — allowed (dev / on-prem).
- Anything else (`http://internal-host`, `file://`, `gopher://`, `javascript:`) — rejected.

This prevents an admin from being phished into setting `E2B_API_URL=http://169.254.169.254/...` and using Phoenix as an SSRF tool.

### Encrypted Credential Storage

Provider credentials are stored in the existing `secrets` table, encrypted at rest with the Phoenix-level encryption key. Decryption only happens at execute time, and the plaintext is fed to the sandbox SDK without touching Phoenix's filesystem or persistent state.

User-defined env vars are stored *by reference*: the `sandbox_configs.config` blob has `env_vars: {VAR_NAME: {secret_key: "..."}}`, and the runner resolves secret_key → plaintext at execute time. Editing a sandbox config never exposes the secret to the UI.

### RBAC

All sandbox provider and config mutations are gated by `IsAdminIfAuthEnabled` (plus the usual `IsNotReadOnly`, `IsNotViewer`, `IsLocked` guards). Only admin users can enable a provider, set credentials, or create configs. Evaluator authors (members) can pick from existing configs but can't create new ones — this prevents an author from quietly creating a config with `internet_access=allow` to exfiltrate data.

---

## Caveats

### Per-Backend Quirks

| Backend | Quirk | Why |
|---------|-------|-----|
| WASM | No `requests`, no `httpx`, limited stdlib | WASI doesn't have a full BSD socket layer in the CPython-on-wasmtime image we ship. Adding a `fetch`-style shim (similar to Pyodide's `pyfetch`) would unlock HTTP but is out of scope for the initial release. |
| Deno | No env vars, no internet, no deps | Subprocess isolation is the whole point; relaxing it defeats the local-backend story |
| E2B | Cold start ~3s on first call | Acceptable because of session pooling |
| Daytona | On-prem URL must be set per-provider, not per-config | Admin-level config; we don't expose deployment routing to authors |
| Vercel | Long-lived session keys partitioned by replica | `AsyncSandbox.create` has no stable-id parameter today |
| Modal | Dependencies are baked at build time, not runtime | Modal's image cache is the right unit of dependency installation; runtime install would re-pay it every call |

### Known Limitations

- **No allowlist internet access yet.** Hosted backends advertise `internet_access_capability="boolean"` — the only modes are "allow all" or "deny all." `InternetAccessMode.ALLOWLIST` is reserved in the GraphQL enum (`server/api/types/SandboxConfig.py`) but is not present in the backend config schema (`InternetAccessConfig.mode: Literal["deny", "allow"]`), so no adapter accepts it.
- **No streaming output.** The runner reads stdout *after* execution completes. A long-running evaluator that prints progress doesn't surface progress to the UI.
- **No cross-experiment or cross-replica sandbox sharing.** The session key partitions on experiment and replica, so a separate experiment using the same evaluator pays its own cold start, and replicas never share remote sandboxes (even when the provider could support it). The win is isolation; the cost is some duplicated cold-start work in scaled-out deployments.
- **`SessionLimitExceeded` is a hard failure.** When the per-provider cap is hit, additional evals fail immediately rather than queueing. The 32-session cap is conservative; we'll raise it once we have customer data.
- **No retries on transient sandbox errors.** A flaky 500 from E2B fails the eval. The experiment runner has retry logic for LLM evaluators but doesn't yet wrap sandbox evaluators. (See [experiment-runner-background-process.md](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/internal_docs/specs/experiment-runner-background-process.md).)
- **No CPU / wallclock budget per execution.** We enforce a `timeout` (default per-config) but no CPU-second cap. A user can write a busy loop and burn the full timeout window.

### Things That Look Like Bugs But Aren't

- **WASM memory cap is per-guest, not global.** Each Wasmtime instance is capped at 128 MiB via `store.set_limits(memory_size=...)`. With 4 worker threads, the worst-case footprint is 4×128 MiB of guest memory plus the shared engine/module cache.
- **Saving a new evaluator version does *not* drop the warm sandbox.** The session key intentionally omits `evaluator_version_id`; the new source code rides along in the harness on the next call. Version is on the sandbox span as metadata for audit, not in the pool key.
- **`config_fingerprint()` doesn't include env-var keys.** Adding a new env var to a config doesn't drop the warm sandbox. The harness picks up the new env on the next call.
- **Deno's `secret_values` set is empty** even when env vars are configured at the type level — because `DenoConfig` doesn't compose `SupportsEnvVars`, the masker has nothing to mask. This is the correct behavior, but it surprised us during code review.

---

## Future Considerations

**Per-host internet allowlists.** The type system supports it; no adapter implements it. E2B and Daytona both expose network policy hooks we could wire up.

**Build-cache visibility for Modal.** Modal's first call after a dependency change rebuilds the image — currently invisible to the user, who just sees a long-running first eval. We should surface "building image" as a span attribute.

**Streaming stdout.** Many evaluators print progress. The fenced result protocol is compatible with streaming (write the fence at the end), but the runner reads stdout only after execution. We'd add a `stream_to_span` hook on `SandboxBackend.execute_in_session`.

**CPU / memory budgets per execution.** Currently only wall-clock timeout. Resource budgets would let us fail fast on accidentally-quadratic evaluators.

**Bring-your-own sandbox.** Customers with their own internal sandbox infrastructure (compliance, air-gap, etc.) could implement a `SandboxAdapter` out-of-tree. The `register_sandbox_adapter()` function is already exposed; what's missing is metadata discovery — `_build_sandbox_adapter_metadata` hardcodes the six built-in adapters — and a plugin-loading hook to call `register_sandbox_adapter()` at startup from third-party code.

**Relaxing replica isolation.** Today the session key includes `replica_id` for every hosted backend, so replicas never share remote sandboxes. An earlier investigation looked at deterministic cross-replica reuse via metadata discovery on E2B / Daytona / Modal; we deferred because the coordination cost outweighed the marginal capacity win at current scale. Vercel can't participate either way because `AsyncSandbox.create` has no stable-id parameter. A future change would have to pick which backends to opt in and accept the additional cross-replica coordination complexity.

**SDK / CLI / REST parity.** Code evaluators and sandbox management are GraphQL-only today. The Python client doesn't have a `create_code_evaluator(...)` helper, the TypeScript client has no sandbox surface, and there are no REST endpoints under `routers/v1/`. Adding any of these is straightforward; we held off until the GraphQL surface stabilized.

**Eval marketplace / templates.** The frontend already has a "templates" menu with built-in starter snippets (`codeEvaluatorTemplates.ts`). A community gallery would let users share JSON-diff / regex-match / embedding-distance evaluators.

---

## Appendix: Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `_DEFAULT_IDLE_TTL_SECONDS` | 300 | Drop idle sessions past this |
| `_DEFAULT_SWEEP_INTERVAL_SECONDS` | 30 | Sweeper period |
| `_DEFAULT_EVICTION_GRACE_SECONDS` | 5 | Grace before evicting a marked entry |
| `_DEFAULT_MAX_SESSIONS_PER_PROVIDER` | 32 | Per-provider concurrency cap |
| `_MAX_WASM_MEMORY_BYTES` | 128 MiB | Per WASM guest instance (4 workers → up to 4×128 MiB) |
| Deno max concurrent subprocesses | 4 | Subprocess pool size |
| WASM thread pool workers | 4 | Off-loop execution |
| Config fingerprint length | 16 chars | sha256 prefix |
| `ENV_PHOENIX_ALLOWED_SANDBOX_PROVIDERS` | `*` | Comma-separated allowlist |

## Appendix: File References

### Backend

| Concept | File |
|---------|------|
| Adapter registry + factory | [src/phoenix/server/sandbox/\_\_init\_\_.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/__init__.py) |
| Type system (configs, credentials, deployments, mixins) | [src/phoenix/server/sandbox/types.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/types.py) |
| Session manager | [src/phoenix/server/sandbox/session_manager.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/session_manager.py) |
| WASM backend | [src/phoenix/server/sandbox/wasm_backend.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/wasm_backend.py) |
| Deno backend | [src/phoenix/server/sandbox/deno_backend.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/deno_backend.py) |
| E2B backend | [src/phoenix/server/sandbox/e2b_backend.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/e2b_backend.py) |
| Daytona backend | [src/phoenix/server/sandbox/daytona_backend.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/daytona_backend.py) |
| Vercel backend | [src/phoenix/server/sandbox/vercel_backend.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/vercel_backend.py) |
| Modal backend | [src/phoenix/server/sandbox/modal_backend.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/modal_backend.py) |
| WASM binary pre-fetch | [src/phoenix/server/sandbox/\_download.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/sandbox/_download.py) |
| `CodeEvaluatorRunner`, fenced parser, schema inference | [src/phoenix/server/api/evaluators.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/evaluators.py) |
| Secret masker | [src/phoenix/server/api/helpers/sandbox_redaction.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/helpers/sandbox_redaction.py) |
| DB models (`SandboxProvider`, `SandboxConfig`, `CodeEvaluator`, `CodeEvaluatorVersion`) | [src/phoenix/db/models.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/db/models.py) |
| Migration | [src/phoenix/db/migrations/versions/0ff41b5b118f_add_sandbox_and_code_evaluator_support.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/db/migrations/versions/0ff41b5b118f_add_sandbox_and_code_evaluator_support.py) |

### GraphQL

| Concept | File |
|---------|------|
| `SandboxConfig`, `SandboxProvider` types | [src/phoenix/server/api/types/SandboxConfig.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/types/SandboxConfig.py) |
| `CodeEvaluator`, `CodeEvaluatorVersion` types | [src/phoenix/server/api/types/Evaluator.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/types/Evaluator.py) |
| Code evaluator mutations | [src/phoenix/server/api/mutations/evaluator_mutations.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/mutations/evaluator_mutations.py) |
| Sandbox config / provider mutations | [src/phoenix/server/api/mutations/sandbox_config_mutations.py](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/src/phoenix/server/api/mutations/sandbox_config_mutations.py) |

### Frontend

| Concept | File |
|---------|------|
| Settings → Sandboxes page | [app/src/pages/settings/sandboxes/SettingsSandboxesPage.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/SettingsSandboxesPage.tsx) |
| Provider enable / credentials | [app/src/pages/settings/sandboxes/SandboxProvidersCard.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/SandboxProvidersCard.tsx), [SandboxProviderCredentialsDialog.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/SandboxProviderCredentialsDialog.tsx) |
| Sandbox config CRUD UI | [app/src/pages/settings/sandboxes/SandboxConfigsCard.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/SandboxConfigsCard.tsx), [SandboxConfigDialog.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/SandboxConfigDialog.tsx) |
| Package spec validation (mirrors backend grammar) | [app/src/pages/settings/sandboxes/utils.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/pages/settings/sandboxes/utils.tsx) |
| Code evaluator authoring dialog | [app/src/components/evaluators/EditCodeEvaluatorDialogContent.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/components/evaluators/EditCodeEvaluatorDialogContent.tsx) |
| Dry-run preview panel | [app/src/components/evaluators/CodeEvaluatorTestSection.tsx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/components/evaluators/CodeEvaluatorTestSection.tsx) |
| Starter templates | [app/src/components/evaluators/codeEvaluatorTemplates.ts](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/app/src/components/evaluators/codeEvaluatorTemplates.ts) |

### Documentation

| Concept | File |
|---------|------|
| Sandboxes settings guide | [docs/phoenix/settings/sandboxes.mdx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/docs/phoenix/settings/sandboxes.mdx) |
| Code evaluators how-to | [docs/phoenix/evaluation/how-to-evals/code-evaluators.mdx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/docs/phoenix/evaluation/how-to-evals/code-evaluators.mdx) |
| Output shapes reference | [docs/phoenix/evaluation/how-to-evals/code-evaluator-output-shapes.mdx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/docs/phoenix/evaluation/how-to-evals/code-evaluator-output-shapes.mdx) |
| Self-hosting sandbox runtimes | [docs/phoenix/self-hosting/features/sandbox-runtimes.mdx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/docs/phoenix/self-hosting/features/sandbox-runtimes.mdx) |
| Tutorial: run experiments with code evals | [docs/phoenix/datasets-and-experiments/tutorial/run-experiments-with-code-evals.mdx](https://github.com/Arize-ai/phoenix/blob/150a83d9e43818938618978ed5f8cc224e08f3a5/docs/phoenix/datasets-and-experiments/tutorial/run-experiments-with-code-evals.mdx) |
