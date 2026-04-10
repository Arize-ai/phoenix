# Phoenix Docs Gap Audit — 2026-04-02 to 2026-04-09 (last 7 days)

Audited against `origin/main` at `ad3621f9926c04d50200077745edc3062f3fc329`.

## Summary

- **64 commits analyzed**, ~33 user-facing, **12 distinct gaps found**
- **High-severity gaps: 6** (four of them are large clusters of stale docs from v14 breaking changes)
- **Packages touched:** `arize-phoenix` (server), `arize-phoenix-client` (Py + TS), `arize-phoenix-evals`, `@arizeai/phoenix-cli`, `app/` (UI), helm/kustomize
- **Single biggest finding:** the v14 breaking-change release note is good, but **the ongoing docs tree was not updated** to match. The `evals 1.0` removal in particular invalidates **9+ primary docs pages** that still teach removed APIs (`OpenAIModel`, `HallucinationEvaluator`, `llm_classify`, `run_evals`, `phoenix.experiments.evaluators`, etc.). Any new user following the current docs will immediately hit `ImportError`.

---

## Gaps

### 1. Evals 1.0 removal — primary docs are broken end-to-end

**Source:** `15e641510` feat(evals)!: deprecate evals 1.0 and remove legacy experiments module (#12239)
**Package(s):** `arize-phoenix-evals` 3.0.0, `arize-phoenix` 14.0.0
**Public surface (what was removed):** verified against `packages/phoenix-evals/src/phoenix/evals/__init__.py:1-45` — the only exported symbols are now `ClassificationEvaluator, Evaluator, LLMEvaluator, Score, ToolSchema, KindType, create_classifier, create_evaluator, async_evaluate_dataframe, evaluate_dataframe, bind_evaluator, LLM, phoenix_prompt_to_prompt_template, download_benchmark_dataset`. Everything else from evals 1.0 — `OpenAIModel`, `AnthropicModel`, `LiteLLMModel`, `BedrockModel`, `VertexAIModel`, `HallucinationEvaluator`, `QAEvaluator`, `RelevanceEvaluator`, `run_evals`, `llm_classify`, `llm_generate`, `RAG_RELEVANCY_PROMPT_TEMPLATE`, `RAG_RELEVANCY_PROMPT_RAILS_MAP`, `phoenix.evals.models.*`, `phoenix.experiments.*` — is gone. Git confirms: `git ls-files packages/phoenix-evals/src/phoenix/evals/{legacy,models}` returns nothing; `git ls-files src/phoenix/experiments` returns nothing.

**What it does:** `arize-phoenix-evals` 3.0 is a hard break — the legacy pre-built evaluators and model wrappers are deleted; the replacement surface is `create_classifier` / `create_evaluator` / `LLMEvaluator` built on top of the new `LLM` wrapper.

**Why a user would use it:** users writing new evals should use the new surface. But most docs still teach the old one.

**Gaps** (all **[High | Stale]** — every snippet below ships in the current tree and will `ImportError` on a fresh `pip install arize-phoenix-evals==3.*`):

| Doc | Line(s) | Stale content |
|---|---|---|
| `docs/phoenix/sdk-api-reference/python/arize-phoenix-evals.mdx` | 35-65 | Imports `RAG_RELEVANCY_PROMPT_TEMPLATE`, `RAG_RELEVANCY_PROMPT_RAILS_MAP`, `OpenAIModel`, `llm_classify` from `phoenix.evals`. **This is the primary SDK reference page for the package.** |
| `docs/phoenix/evaluation/evals.mdx` | 67-89 | `from phoenix.evals import HallucinationEvaluator, OpenAIModel, QAEvaluator, run_evals` — primary evaluation quickstart. `run_evals(dataframe=df, evaluators=[hallucination_evaluator, qa_evaluator], ...)` no longer exists. |
| `docs/phoenix/use-cases/rag-evaluation.mdx` | 259, 272, 399, 580-586 | Uses `OpenAIModel`, `llm_generate`, `QAEvaluator`, `HallucinationEvaluator`, `RelevanceEvaluator`. |
| `docs/phoenix/datasets-and-experiments/quickstart-datasets.mdx` | 265, 311-314 | `from phoenix.experiments.evaluators import ContainsAnyKeyword` and `from phoenix.experiments.evaluators import ConcisenessEvaluator` / `from phoenix.evals.models import OpenAIModel`. Both modules are deleted; there is no direct replacement for `ContainsAnyKeyword` / `ConcisenessEvaluator` in `phoenix.client.experiments` (verified in `packages/phoenix-client/src/phoenix/client/experiments/__init__.py`). |
| `docs/phoenix/datasets-and-experiments/how-to-datasets/creating-datasets.mdx` | 121, 134 | `from phoenix.evals import OpenAIModel, llm_generate`. |
| `docs/phoenix/integrations/llm-providers/openai/openai-evals.mdx` | 7-68 | Documents the removed `phoenix.evals.OpenAIModel` class, including the Azure variant — this is the *entire* page. |
| `docs/phoenix/integrations/llm-providers/anthropic/anthropic-evals.mdx` | — | Same pattern — documents removed `AnthropicModel`. (grep confirmed file matches `AnthropicModel`.) |
| `docs/phoenix/integrations/llm-providers/amazon-bedrock/amazon-bedrock-evals.mdx` | — | Documents removed `BedrockModel`. |
| `docs/phoenix/integrations/llm-providers/vertexai/vertexai-evals.mdx` | — | Documents removed `VertexAIModel`. |
| `docs/phoenix/integrations/llm-providers/litellm/litellm-evals.mdx` | — | Documents removed `LiteLLMModel`. |
| `docs/phoenix/cookbook/prompt-engineering/llm-as-a-judge-prompt-optimization.mdx` | 165, 174, 239, 305, 379, 427, 457 | Repeatedly uses `OpenAIModel`. |
| `docs/phoenix/cookbook/prompt-engineering/react-prompting.mdx` | 65, 302, 386 | Same. |
| `docs/phoenix/cookbook/human-in-the-loop-workflows-annotations/creating-a-custom-llm-evaluator-with-a-benchmark-dataset.mdx` | 149, 159 | `from phoenix.evals import OpenAIModel`. |
| `docs/phoenix/cookbook/human-in-the-loop-workflows-annotations/using-human-annotations-for-eval-driven-development.mdx` | 194, 240 | `OpenAIModel(model="gpt-4.1")` / `OpenAIModel(model="gpt-4o")`. |
| `docs/phoenix/resources/frequently-asked-questions/how-do-i-resolve-phoenix-evals-showing-not_parsable.mdx` | 14 | `OpenAIModel(...)` as the FAQ answer. |

**Proposed content** (verified against current exports):

```python
# before
from phoenix.evals import HallucinationEvaluator, OpenAIModel, QAEvaluator, run_evals

eval_model = OpenAIModel(model="gpt-4o")
hallucination_evaluator = HallucinationEvaluator(eval_model)
qa_evaluator = QAEvaluator(eval_model)
hallucination_eval_df, qa_eval_df = run_evals(dataframe=df, evaluators=[...])

# after — current 3.0 surface
from phoenix.evals import LLM, create_classifier, evaluate_dataframe

llm = LLM(provider="openai", model="gpt-4o")
hallucination_classifier = create_classifier(
    name="hallucination",
    llm=llm,
    prompt_template="...",       # migrate the old template here
    choices={"factual": 1.0, "hallucinated": 0.0},
)
results = evaluate_dataframe(dataframe=df, evaluators=[hallucination_classifier])
```

A maintainer or Phoenix Evals owner will have to author the exact replacement for each pre-built evaluator (Hallucination, QA, Relevance, RAGRelevance, etc.) — this skill should not invent those mappings. The point of this gap entry is that **no such replacement is documented anywhere** other than the four-line `LLM` blurb in `packages/phoenix-evals/README.md`.

---

### 2. Evals 1.0 — stale `phoenix.experiments.*` imports in datasets quickstart

**Source:** `15e641510` (same removal)
**Public surface:** `src/phoenix/experiments/` has no tracked files (only `.pyc` bytecode remains locally from prior installs). The replacement module is `packages/phoenix-client/src/phoenix/client/experiments/__init__.py`, which exports `run_experiment`, `async_run_experiment`, `get_experiment`, `resume_experiment`, `resume_evaluation`, `evaluate_experiment`, `create_evaluator`, `Dataset`, `RanExperiment` (verified).

**Gaps:**

- **[High | Stale]** `docs/phoenix/datasets-and-experiments/quickstart-datasets.mdx:265` and `:311` — `from phoenix.experiments.evaluators import ContainsAnyKeyword` and `ConcisenessEvaluator`. Same ImportError pattern as above — already listed in gap #1 for completeness. The TypeScript side of the same Tabs block (`@arizeai/phoenix-client/experiments`) is fine and gives the current pattern, so the fix is to rewrite the Python tab to match.

- **[Medium | Missing rationale]** `phoenix.client.experiments` has no top-level MDX page at `docs/phoenix/datasets-and-experiments/` introducing it as the replacement. Users only learn about it from the breaking-changes release note. A dedicated "Migrating from `phoenix.experiments`" or "Using `phoenix.client.experiments`" page should live at `docs/phoenix/datasets-and-experiments/how-to-experiments/using-the-client.mdx` (or similar).

---

### 3. GraphQL — `first` is now required on forward pagination (BREAKING, **no release note**)

**Source:** `ed559c46e` feat(graphql)!: require explicit first for forward pagination (#12526)
**Package:** `arize-phoenix` server (GraphQL schema)
**Public surface:**
- `src/phoenix/server/api/extensions/pagination.py:21-101` — new `RequireForwardPaginationExtension` field extension. Requires `first: Int!` (non-null, no default), rejects `last` and `before`, caps `first` at `DEFAULT_MAX_PAGE_SIZE = 1000` unless `max_page_size=None`.
- Applied to three connection fields (verified via grep):
  - `src/phoenix/server/api/types/Project.py:332` — `Project.spans`
  - `src/phoenix/server/api/types/Trace.py:192` — `Trace.spans`
  - `src/phoenix/server/api/types/ProjectSession.py:155` — `ProjectSession.traces`

**What it does:** previously optional `first` is now required on three commonly-queried connections; unbounded or backward pagination is rejected with a `BadRequest("\`first\` is required")` — at both schema build time (the schema shape changed) and resolve time.

**Why a user would use it:** protects the server from unbounded queries. Users who hand-wrote GraphQL clients without `first` now get hard failures on upgrade to v14.

**Gaps:**

- **[High | Missing]** `docs/phoenix/release-notes/04-2026/04-07-2026-phoenix-v14-breaking-changes.mdx` — the v14 breaking-changes release note covers the CLI, `px.Client()`, `/v1/evaluations`, and evals 1.0, but **does not mention this GraphQL schema change**. Any external GraphQL consumer (Phoenix has one — `project.spans` and friends are used by the frontend, but third parties can hit the public `/graphql` endpoint too) is in for a surprise.
- **[High | Missing]** No GraphQL reference docs exist at all under `docs/phoenix/sdk-api-reference/` — grep confirmed zero matches for "GraphQL" in API reference. That's a separate, older gap, but this change makes it more urgent because there is no single place to communicate the new contract.
- **[Medium | Missing]** Max page size (`1000`) is a constant in code (`DEFAULT_MAX_PAGE_SIZE`). It is not documented in `environments.mdx`, `self-hosting/configuration.mdx`, or anywhere else. If a user hits `\`first\` must be less than or equal to 1000`, they have no doc to find.

**Proposed addition to the v14 release note:**

> ## GraphQL: `first` is now required on `Project.spans`, `Trace.spans`, and `ProjectSession.traces`
>
> These forward-pagination fields now require an explicit positive `first` argument (max 1000) and no longer accept `last`/`before`. Queries written against v13 that paginate without `first` will fail with `\`first\` is required`. Update hand-written queries to pass `first: <N>` explicitly.

---

### 4. CLI `delete` subcommands — undocumented across every surface

**Source:** `652c29804` feat(cli): add delete subcommands with confirmation (#12518)
**Package:** `@arizeai/phoenix-cli`
**Public surface:** new `delete` subcommands under every major noun — verified via the commit message and `js/packages/phoenix-cli/src/commands/dataset.ts:287-401` (the `dataset delete` pattern, which is replicated for the other nouns):
- `px dataset delete`
- `px project delete`
- `px trace delete`
- `px experiment delete`
- `px session delete`
- `px annotation-config delete`
- `px prompt delete`
- `px span delete`

Each is gated on `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` (env) and confirmation (interactive `y/yes`, or `--yes`/`-y` in non-TTY contexts).

**What it does:** mutates server state — deletes resources through the REST API. Cascade warnings are surfaced in the prompts for projects/sessions/prompts/traces.

**Why a user would use it:** cleanup, CI teardown, scripted removal.

**When NOT to use it / alternatives:** destructive; no undo. Exit code 3 if not confirmed in non-TTY.

**Gaps:**

- **[High | Missing]** `js/packages/phoenix-cli/README.md` — mentions the env var gate on line 54 but **none of the eight new subcommands are documented in the README**. The README has detailed sections for every `list`/`get` command; `delete` is absent.
- **[High | Missing]** `docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-cli.mdx` — the Mintlify mirror of the README. Zero matches for "delete". Same gap.
- **[Medium | Missing]** `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` is not listed in `docs/phoenix/environments.mdx` or `docs/phoenix/self-hosting/configuration.mdx`. Any user searching "how do I delete from Phoenix CLI" will find nothing.
- **[Medium | Missing rationale]** The safety tiers (TTY prompt, `--yes`, non-TTY fail-closed) are exactly the kind of thing a CI author needs to know. They are in the commit message but nowhere a user will read them.

**Proposed content** (for the CLI README, repeated once per noun):

```markdown
### `px dataset delete <dataset-id>`

Delete a dataset by ID. Gated on `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true`.

    px dataset delete ds_123          # prompts for confirmation in a TTY
    px dataset delete ds_123 --yes    # bypass prompt (required in CI/non-TTY)

| Option                  | Description                                 | Default |
| ----------------------- | ------------------------------------------- | ------- |
| `-y, --yes`             | Skip confirmation prompt                    | —       |

Exit codes: `0` success, `3` confirmation declined or missing in non-TTY.
```

---

### 5. Background experiment runner — a major feature with zero user docs

**Source:** `a769a61f1` feat: background experiment runner (#11731) + `69d197ed3` feat(experiments)!: define ephemeral experiments and add ExperimentSweeper daemon (#11815) + `e83c18b2d` refactor(server): rework experiment runner scheduling and queue backpressure (#12563) + `62119108c` feat(experiments): structured error table (#12558) + `7e7c20481` feat: poll experiments table when jobs are running (#12483) + `33ec19a02` feat: include span and experiment run in error subscription payloads (#12464) + `3ffc63f53` fix: persist error records for all terminal experiment outcomes (#12463) + `24d956cce` fix(experiments): fix lastError query failing on SQLite (#12499)

**Package:** `arize-phoenix` server + `app/` UI
**Public surface:**
- `src/phoenix/server/daemons/experiment_runner.py:2133-2192` — new `ExperimentRunner` singleton daemon. Docstring: *"Singleton daemon that orchestrates background experiment execution. Key patterns: Semaphore-first dispatch ... Round-robin fairness ... Non-blocking rate limits ... Auto-resume: orphaned experiments resumed on startup."* `MAX_CONCURRENT = 1000` seats; `POLL_INTERVAL = 0.1`; replicas coordinate ownership via `_replica_id = token_hex(8)`.
- `src/phoenix/server/daemons/experiment_sweeper.py:22-69` — new `ExperimentSweeper` daemon that periodically deletes ephemeral experiments older than `EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS = 24` (`src/phoenix/config.py:3314`).
- `src/phoenix/db/models.py:1499-1526` — new `Experiment.is_ephemeral` boolean column plus partial index `ix_experiments_ephemeral_updated_at`.
- `src/phoenix/db/migrations/versions/9c5c1f6bd0d2_add_is_ephemeral_to_experiments.py` and `aba52fffe1a1_add_experiment_jobs.py` — schema migrations.
- New GraphQL types: `src/phoenix/server/api/types/ExperimentJob.py`, `ExperimentError.py`, `ExperimentTaskConfig.py`.
- New Python client entry points: `packages/phoenix-client/src/phoenix/client/experiments/__init__.py:464` `resume_experiment`, `:800` `resume_evaluation`, `:602` `async_resume_experiment` — verified via `grep -n "def " …/experiments/__init__.py`.

**What it does:** experiments no longer run exclusively in the caller's foreground process. The server now owns a persistent `experiment_jobs` queue; a singleton `ExperimentRunner` daemon leases jobs per replica, runs them with concurrency/rate-limit controls, survives replica crashes via heartbeat + orphan scans, and surfaces structured errors in a new UI error table (`app/src/pages/experiments/ExperimentDetailsDialog.tsx`). "Ephemeral" experiments created from the Playground are automatically swept after 24h.

**Why a user would use it:** long-running experiments no longer die when the laptop closes; they can be resumed. Playground users get cleanup for free.

**When NOT to use it:** N/A — users do not opt in; this is the new default. That's precisely why docs matter.

**Gaps:**

- **[High | Missing]** Zero user-facing docs exist. Grep: `docs/phoenix/**/*.mdx` has no matches for `resume_experiment`, `ExperimentSweeper`, `experiment_runner`, `ExperimentJob`, `ephemeral`, or `is_ephemeral` in the experiments sense. The extensive `internal_docs/specs/experiment-runner-background-process/` spec tree is internal-only (path says so).
- **[High | Missing]** `packages/phoenix-client/README.md` and `docs/phoenix/sdk-api-reference/python/arize-phoenix-client.mdx` do not document `resume_experiment` / `async_resume_experiment` / `resume_evaluation`. These are new top-level exports from `phoenix.client.experiments`.
- **[High | Missing]** `docs/phoenix/datasets-and-experiments/` has no page describing how resume/retry works, or that experiments survive process death, or how ephemeral experiments relate to playground runs.
- **[High | Missing]** `EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS` is a hardcoded constant (`src/phoenix/config.py:3314`). If a user complains "my playground experiment disappeared," there is no doc to point them at. Whether this should be user-configurable is a design question for the author; either way it needs to be documented.
- **[High | Missing]** No release note. The v14 breaking-change note covers CLI/client/evals but not the new experiment runtime. Ephemeral experiments are technically a breaking DB schema change on top.
- **[Medium | Missing rationale]** Why background execution? The spec (internal) gives the answer — crash recovery, multi-replica coordination — but a user reading the Phoenix docs has no way to find that motivation.

**Proposed content** (a new doc page):

```markdown
# Background Experiment Runtime (v14+)

Experiments in Phoenix v14 run on the server instead of inside the calling
Python process. `run_experiment(...)` enqueues a job and streams results; if
your process dies, the experiment continues and you can reconnect with
`resume_experiment(experiment_id=...)`.

## How it works
- Jobs are stored in an `experiment_jobs` table and leased by the server's
  `ExperimentRunner` daemon.
- Concurrency is bounded per-job via `max_concurrency` on the task config.
- In multi-replica deployments, one replica owns a job at a time; heartbeats
  and orphan scans recover work from crashed replicas automatically.

## Resuming

    from phoenix.client.experiments import resume_experiment
    experiment = resume_experiment(experiment_id="exp_abc123")

## Ephemeral experiments
Experiments created from the Playground are marked ephemeral and are swept
24 hours after their last update. They still appear in the UI for
comparison while they exist. Non-ephemeral experiments are never auto-swept.
```

Rationale paragraphs should come from the paper `internal_docs/specs/experiment-runner-background-process.md` — that content can be rewritten for the user audience rather than re-invented.

---

### 6. `/v1/evaluations` removal — stale REST permissions table row

**Source:** `a1e9bbd6c` refactor(server)!: remove /v1/evaluations endpoint (#12538)

**Gaps:**

- **[Medium | Stale]** `docs/phoenix/self-hosting/features/authentication.mdx:137` — the REST API permissions table still lists *"Projects, datasets, experiments, prompts, spans, traces, annotations, annotation configs, **evaluations**"* under **GET requests**. Trivial fix: drop "evaluations" from that line. Verified removal in `schemas/openapi.json` (no `v1/evaluations` matches) and deleted router in `src/phoenix/server/api/routers/v1/` (the commit deletes `evaluations.py`).

No other stale refs — the release note and migration guide handle the user-migration story. The two deleted REST reference pages in `docs/phoenix/sdk-api-reference/rest-api/api-reference/traces/` were properly removed in the same commit.

---

### 7. OAuth2 username fallback — undocumented behavior change

**Source:** `29ee043f2` oauth2: fall back to email local part when name claim is empty (#12603)
**Public surface:** `src/phoenix/server/api/routers/oauth2.py:751-757`:

```python
email = user_info.email
# The users.username column is NOT NULL, but the OIDC `name` claim is
# optional and some IDPs omit it or return an empty string. Fall back
# to the local part of the email so we always have a non-empty value
# to satisfy the constraint; a random suffix is appended below if it
# collides with an existing username.
username = user_info.username or email.split("@", 1)[0]
```

**What it does:** for IdPs whose `name` claim is empty/missing (some Azure AD, Okta, custom OIDC setups), Phoenix now auto-derives a username from the email instead of failing with a DB constraint error.

**Gaps:**

- **[Low | Missing]** `docs/phoenix/self-hosting/features/authentication.mdx` has a large OAuth2 config section (verified, lines 278-282+) but never documents how the `username` column is populated. Useful to note for admins wondering why some users' display names look like email local parts. Not strictly blocking; a one-line note would suffice.

---

### 8. `phoenix-client` TS — `EvaluatorParams.traceId` README incompleteness

**Source:** `c70eca619` feat(phoenix-client): pass task traceId to evaluator params (#12525)
**Package:** `@arizeai/phoenix-client` 2.3.0
**Public surface:** `js/packages/phoenix-client/src/types/experiments.ts:139` — `traceId?: string | null` added to `EvaluatorParams`.

**Gaps:**

- **[Low | Incomplete]** `docs/phoenix/sdk-api-reference/typescript/packages/phoenix-client/experiments.mdx` is already up to date (verified — mentions `traceId` on lines 15, 231, 235, 239, 293, 301, 310, 336-337). Good.
- **[Low | Incomplete]** `js/packages/phoenix-client/README.md` — has `traceIds` for `getSpans` (line 399) but does not mention `EvaluatorParams.traceId`. Not a blocking gap since the Mintlify reference covers it, but worth a one-liner cross-reference.

---

### 9. Adjacent staleness — `SpanEvaluations` dead imports

**Source:** predates this window (cleanup opportunity surfaced while checking `/v1/evaluations`)

**Gaps:**

- **[Low | Stale]** `docs/phoenix/integrations/python/pydantic/pydantic-evals.mdx:297` imports `from phoenix.trace import SpanEvaluations` but the snippet below uses `client.spans.log_span_annotations_dataframe(...)` and never references `SpanEvaluations`. Dead import — delete the line. `SpanEvaluations` the class is still exported from `src/phoenix/trace/__init__.py:4` so this is not strictly stale, just unused.
- **[Low | Stale]** `docs/phoenix/cookbook/evaluation/openai-agents-sdk-cookbook.mdx:256` — same dead import.

These are not caused by this week's commits but they share the code path the v14 migration touches. Worth sweeping in the same PR as gap #1.

---

### 10. New config knobs with no mention in `environments.mdx`

Several env vars / configuration defaults landed this week but none made it to the environments reference page:

| Var / default | Where defined | Surface touched |
|---|---|---|
| `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` | `js/packages/phoenix-cli/README.md:54` only | TS CLI (gap #4) |
| `EPHEMERAL_EXPERIMENT_TIME_TO_LIVE_HOURS=24` | `src/phoenix/config.py:3314` (hardcoded, not env) | experiment sweeper (gap #5) |
| `DEFAULT_MAX_PAGE_SIZE=1000` | `src/phoenix/server/api/extensions/pagination.py:18` (hardcoded) | GraphQL (gap #3) |

**[Medium | Missing]** None of these appear in `docs/phoenix/environments.mdx` or `docs/phoenix/self-hosting/configuration.mdx`. All three of the hardcoded ones are operator-relevant — if you run Phoenix at scale you will want to know these limits exist.

---

### 11. `docs/phoenix/evaluation/evals.mdx` structure is stale end-to-end

Flagging separately because the full rewrite needed is bigger than the per-line list in gap #1. This is the canonical entry point for Phoenix evals from the top-level docs nav. Its current structure (`from phoenix.evals import HallucinationEvaluator, OpenAIModel, QAEvaluator, run_evals` → `run_evals(dataframe=df, evaluators=[...])`) reflects the v1 design. The v3 `Evaluator` / `create_classifier` / `evaluate_dataframe` design has a different mental model (per-row callables bound to an `LLM`, not bulk `run_evals`).

**[High | Stale]** `docs/phoenix/evaluation/evals.mdx` needs a full rewrite by an evals owner, not just line patching. The replacement should mirror `packages/phoenix-evals/src/phoenix/evals/__init__.py` exports and use a working runnable snippet end-to-end.

---

### 12. PXI (Phoenix Intelligence) agent — no external doc footprint

**Source:** `30dfdb557`, `8168a8fde`, `d28c122f1`, `b228134a8`, `ced465e56`, `899a8cbc2`, `c887c9393`, `70afa984f` — seven agent-related commits this week.

**Gaps:**

- **[Low | Missing]** The in-product agent (PXI / Phoenix Intelligence) is not mentioned anywhere in `docs/phoenix/**`. Grep for `Phoenix Intelligence` / `\bPXI\b` returns zero. Arguably this is an in-product, self-discoverable feature and doesn't need doc coverage yet, but noting it so a product owner can decide. Relevant new capabilities this week: chat runtime shared across panels (`30dfdb557`), keeps streaming when panel closes (`8168a8fde`), panel FAB / stop button (`d28c122f1`), backend MCP docs tool (`b228134a8`), ask_user elicitation tool (`ced465e56`), backend tool-loop exhaustion surfaced (`c887c9393`), replayed chat history spans removed (`899a8cbc2`).

No action required unless the product owner wants to open a "Phoenix Intelligence" landing page.

---

## Commits skipped (and why)

- `ad3621f99` — CI workflow for this very skill. Internal.
- `97878e4af`, `54c6c324c` — auto-generated sitemap updates.
- `3a55bae1c` — the release-note commit itself (verified its contents above).
- `cd6199564` — test-only UTF-8 fix.
- `cd6601490`, `965cf9824` — helm/kustomize version-string bumps tied to release bookkeeping.
- `770643725`, `a90ac9ff9`, `846b72711`, `e5c9e8d67`, `a33630d19`, `aa3738e90`, `e9fa535a7`, `252fb393f` — release-please / CHANGELOG bookkeeping.
- `7d5e8f7d0` — feature-branch chore.
- `266813bb6`, `e4db3ad13`, `87997f5ca` — vite dev-dep bumps inside unrelated dev containers.
- `1135a3d38` — Vale spelling dictionary.
- `a87610a04` — fastmcp bump in a tutorial's requirements file.
- `b60f1be53` — one-line docs fix.
- `113836a5b`, `47a87208f`, `07eb543fc`, `c0dc8ee60`, `fd3a50ff5` — agent-skills organization/metadata.
- `436739fb9` — check-card-links CI workflow fix.
- `3176c33d5` — new `examples/agents/**` sample trees. Examples are not a documented public surface in this repo, so not a gap even though the READMEs are new.
- `d74be37ce` — adds valid OpenAPI examples for span creation. This is itself a docs fix.
- `37592357e` — the secrets REST reference page being audited. Already documented.
- `2fc77cf6d`, `cd0dfaa09` — DB-schema-handling bugfixes; behavior is "unchanged under supported configs".
- `8549fde5b` — internal dataloader fix; user sees only fewer 500s.
- `afd958407` — already has user docs at `docs/phoenix/tracing/how-to-tracing/advanced/constructing-urls.mdx` (verified).
- `3163faef6` — PostgreSQL read replica; covered by release note + `self-hosting/configuration.mdx:46` + `helm/README.md:97` (verified).
- `26b94ce78` — playground span `output.value` now holds raw vendor response for non-streaming. Behavior change visible only in span inspection; no user API changed. Low priority — would fit in a future release note bullet but not a standalone gap.
- `f14eaef46`, `62119108c`, `e83c18b2d`, `7e7c20481`, `33ec19a02`, `3ffc63f53`, `24d956cce` — rolled into gap #5 (background experiment runner cluster).
- `64263742d` — evals now call LLMs non-streaming. Internal perf/consistency improvement, not a documented surface.
- `ed24c0974` — psycopg→asyncpg migration driver swap. User-invisible except in deep troubleshooting.
- `59784a1ad` — removes protobuf evaluation ingestion path; already mentioned in the v14 release note ("`protobuf` is no longer a direct dependency").
- `4c27a0baa` — legacy client removal; covered by gap #1-adjacent updates (docs touched in the same commit) and the v14 release note.
- `15e641510` — see gaps #1 and #2.
- `a1e9bbd6c` — see gap #6.
- `b1c4da026` — see gap #3 (only the GraphQL side is missing from the release note).
- `69d197ed3`, `a769a61f1` — see gap #5.
- `ed559c46e` — see gap #3.
- `652c29804` — see gap #4.
- `c70eca619` — see gap #8.
- `29ee043f2` — see gap #7.

If any of the "skipped" entries look wrong, read the linked file/line and re-triage.
