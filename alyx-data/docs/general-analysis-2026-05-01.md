# Alyx production traffic — general analysis (2026-05-01)

90-day analysis of Arize `copilot-prod` (Alyx) production traces. Window:
**2026-01-31 → 2026-05-01 UTC**, 400,560 raw spans, 25,464 user queries
across 13,732 sessions.

**Status:** Draft. All numbers reproduce from
`notebooks/stage2-analysis.ipynb`. Cells producing each numeric claim
are tagged with a `# REPORT:` comment in the notebook for quick lookup.

This report builds on `pxi-eval-dataset/findings-2026-04-22.md` (the
predecessor's first-pass on a slightly older 90d window) and extends it
with **trajectory-level findings** that the predecessor's pipeline
didn't have access to.

The report is the gate for two downstream decisions:

1. Stage 3 design — the right grouping/clustering approach for
   use-case identification.
2. The optional **interactive NL-query agent** — go/no-go.

Both decisions are addressed in the closing **Stage 3 framing** section.

## TL;DR

- **Scale.** 400k raw spans, 25k user queries, 13.7k sessions across
  90 days. ~+3% vs predecessor on raw spans; the corpus is healthy and
  reproducible from scratch in ~50 min.
- **Internal vs external.** External traffic now overtakes internal
  every month; April is 60% external (predecessor's "growing trend"
  continues). External users drive **longer, tool-heavier, more errored
  sessions** — not the reverse, contrary to common assumption.
- **Surface concentration.** External customers concentrate on
  **CHAT + SEARCH + TRACE_AGENT** (≈54% of external volume). SEARCH is
  almost entirely external (90%). HOME_PAGE is half landing-page seed
  buttons.
- **Multi-turn ≠ refinement.** Of 16k follow-up turns, **60% are new
  questions** in the same session. Only 13% are refinements. Synthetic
  agent evals built around "user refines previous answer" don't reflect
  the dominant real shape.
- **Failure shapes.** Errors hit 8% of sessions; 2.3% are truncated
  trajectories (last span errored). Retry-language follow-ups are very
  rare (97 sessions). Implicit-negative-feedback signals are **specific
  but not sensitive**.
- **CUSTOM_EVAL is the leakiest surface** at 17% session error rate —
  Alyx-as-eval-author has unsolved problems and is a strong Pixie-eval
  target.
- **Stage 3 recommendation.** Don't roll up by session; treat each
  query as the unit. Cluster within router type. Keep internal traffic
  flagged but include it. Build the NL-query agent (low cost, high
  iteration leverage).

## 1. Corpus inventory

| Layer | Rows | Note |
|---|---:|---|
| Layer 0 — raw spans | 400,560 | 7 chunks, 2.1 GB on disk |
| Layer 1 — user queries (flagged) | 25,464 | 267 dropped as `is_empty` |
| Layer 1 — `is_internal` | 11,554 | 45.4% of queries |
| Layer 1 — `is_seed_button_match` | 4,768 | 18.7% of queries |
| Layer 2 — Alyx-only spans | 283,313 | non-Alyx noise filtered |
| Layer 2 — sessions | 13,732 | one row per `attributes.session.id` |
| Layer 2 — errored sessions | 1,100 | 8.0% of sessions |

(Notebook cell `corpus-inventory`.)

## 2. Drift vs predecessor (Apr 2026)

Most numbers within ±15% of `findings-2026-04-22.md`. Two routers
flagged at >20% drift; both go in the same direction (more landing-page
+ search use, less internal PROMPT_OPTIMIZATION dogfood):

| Metric | Predecessor | Current | Δ |
|---|---:|---:|---:|
| Raw spans | 388,420 | 400,560 | +3% |
| Layer 1 queries | 24,733 | 25,464 | +3% |
| Internal share | 50.0% | 45.4% | −9% |
| PROMPT_OPTIMIZATION raw % | 32% | 27.3% | −15% |
| **HOME_PAGE raw %** | **12%** | **14.9%** | **+24% ⚠** |
| **SEARCH raw %** | **9%** | **11.2%** | **+24% ⚠** |
| Single-turn share | 53% | 56.3% | +6% |
| April internal share | 42.1% | 40.2% | −5% |

We treat the flagged drifts as healthy growth signals (consistent with
the predecessor's "April internal share trending down" call), not
measurement artifacts.

(Cell `drift`.)

## 3. What people ask Alyx — taxonomy refresh

Alyx still classifies every root agent span with a router type. 12
routers observed in this window — predecessor's 9 plus three new
surfaces (`EVAL_HUB`, `EVAL_DETAIL`, `CLUSTER_SUMMARY`):

| Router | Raw % | External % |
|---|---:|---:|
| PROMPT_OPTIMIZATION | 27.3% | 15.0% |
| CHAT | 19.3% | 18.8% |
| HOME_PAGE | 14.9% | 17.4% |
| SEARCH | 11.2% | 18.4% |
| TRACE_AGENT | 10.8% | 13.6% |
| CUSTOM_EVAL | 6.7% | 5.1% |
| EXPERIMENT_SUMMARY | 4.6% | 6.5% |
| AQL | 2.6% | 3.5% |
| TASK_PAGE | 2.3% | 1.3% |
| EVAL_HUB | 0.2% | 0.3% |
| CLUSTER_SUMMARY | <0.1% | <0.1% |
| EVAL_DETAIL | <0.1% | <0.1% |

(Cell `router-table` / `router-bars`.)

The predecessor's headline holds: PROMPT_OPTIMIZATION halves on the
external slice, and **CHAT + SEARCH + TRACE_AGENT** account for
**51%** of external queries (predecessor: 54%). That's where Pixie eval
coverage should concentrate.

## 4. Volume / growth

External-query volume by week (cell `weekly`):

- Late January (week of Jan 27): ~50/week
- Mid April (week of Apr 14): ~1,626/week
- **~33× growth in 11 weeks.**

Predecessor saw 9× growth over a slightly shorter window; Alyx is
still on its adoption ramp.

Internal share by month (cell `monthly-internal`):

| Month | External | Internal | Internal % |
|---|---:|---:|---:|
| 2026-01 (partial) | 0 | 12 | 100% |
| 2026-02 | 2,993 | 2,924 | 49.4% |
| 2026-03 | 4,631 | 4,447 | 49.0% |
| 2026-04 | **6,123** | 4,108 | **40.2%** |
| 2026-05 (partial) | 163 | 63 | 27.9% |

April crossed the 60/40 threshold in favor of external traffic.

## 5. Customer segments

Top external orgs by query volume (cell `top-orgs`):

| Org | Queries |
|---|---:|
| Disney | 844 |
| UKG | 478 |
| Booking.com - PROD | 290 |
| stg | 243 |
| Resmed | 217 |
| Agentic EOR | 201 |
| Prod | 176 |
| Quizlet POC | 161 |

Per-org router mix (cell `top-org-router`) confirms the predecessor's
"different orgs use Alyx differently" framing — Disney leans
TRACE_AGENT-heavy, Booking.com leans SEARCH, etc. Exact percentages
are in the notebook; not reproduced here pre-PII-pass.

## 6. Session structure

Turn-count distribution (cell `turn-dist`):

| Turns | Sessions | Share |
|---|---:|---:|
| 1 | 7,734 | 56.3% |
| 2 | 3,415 | 24.9% |
| 3 | 976 | 7.1% |
| 4–7 | 1,155 | 8.4% |
| 8–19 | 354 | 2.6% |
| 20+ | 75 | 0.5% |

Single-turn share is up 3pp from the predecessor (53% → 56%). Long-tail
share (≥8 turns) is down (8% → 3.1%). Plausibly: more new external
users on the landing page (HOME_PAGE single-turn) and fewer power
users buried in long debugging arcs.

Longest single session: **152 turns / 1,884 spans / 3 errors** (Disney,
TRACE_AGENT). Predecessor maxed at 139 turns.

## 7. Language diversity

| Bucket | Queries |
|---|---:|
| Pure ASCII | 24,051 |
| Any non-ASCII | 1,413 |
| Heavy non-ASCII (>30%) | 180 |

Within ±20% of predecessor's 226 heavy-non-ASCII; international users
remain a real segment.

## 8. Trajectory shape per router (NEW — Layer 2)

(Cell `shape`.) Median duration is reported instead of mean because
session_ids occasionally span days as users return to the same UI
session, blowing the mean.

| Router | Sessions | Avg turns | Avg spans | Avg tool calls | Median dur (min) | Error rate |
|---|---:|---:|---:|---:|---:|---:|
| PROMPT_OPTIMIZATION | 4,182 | 2.3 | 16.9 | 8.7 | 1.0 | 6% |
| HOME_PAGE | 2,581 | 1.5 | 9.3 | 4.6 | 0.2 | 4% |
| CHAT | 2,225 | 2.6 | 33.6 | 18.3 | 1.1 | 12% |
| SEARCH | 1,212 | 2.4 | 30.5 | 15.1 | 0.5 | 5% |
| CUSTOM_EVAL | 1,136 | 1.8 | 18.0 | 9.8 | 0.5 | 17% |
| TRACE_AGENT | 1,061 | 2.8 | 27.4 | 14.1 | 0.5 | 8% |
| EXPERIMENT_SUMMARY | 624 | 2.2 | 24.1 | 12.7 | 1.1 | 15% |
| TASK_PAGE | 486 | 1.4 | 14.3 | 8.4 | 0.3 | 14% |
| AQL | 138 | 4.1 | 31.5 | 15.6 | 0.8 | 6% |

Two patterns:

- **CHAT and TRACE_AGENT are the deepest trajectories** (avg ~30 spans,
  ~15 tool calls per session). These are where Alyx does its real
  multi-step investigation work.
- **AQL has the most turns per session** (4.1) — users iterate on
  filter expressions until they get what they want. Refinement-heavy
  by nature.

## 9. Tool-call patterns (NEW — Layer 2)

148,281 named Alyx tool calls in the window (cell `tool-top`). Top 10:

| Tool | Calls |
|---|---:|
| `finish` | 21,311 |
| `todo_update` | 18,167 |
| `playground_agent` | 9,423 |
| `jq` | 8,483 |
| `todo_write` | 6,113 |
| `get_traces_table_preview` | 5,719 |
| `validate_filter` | 5,412 |
| `traces_agent` | 5,155 |
| `get_spans` | 4,883 |
| `get_model_columns` | 4,216 |

Two surprises worth flagging:

- **`finish` and `todo_update`/`todo_write` dominate** — these are
  Alyx's internal task-management primitives, not user-visible
  capabilities. Stage 3 should down-weight them when characterizing
  what tools each use case needs.
- **`jq`** at #4 — Alyx is post-processing JSON returns from other
  tools at a meaningful clip. Pixie likely needs the same capability.

Per-router tool signatures are coherent (cell `tool-by-router`):

- **CHAT** → `todo_update`, `finish`, `get_traces_table_preview`,
  `traces_agent` — the "look at traces and tell me what's happening"
  loop.
- **AQL** → `generate_aql`, `validate_filter`, `get_model_columns` —
  build a query, validate, look up schema.
- **CUSTOM_EVAL** → `eval_agent`, `build_eval`, `create_eval_form` —
  scaffold an evaluator end-to-end.

This per-router tool signature is the clearest fingerprint of "what
each surface is *for*" we have. Stage 3 should preserve it.

## 10. Failure shapes (NEW — Layer 2)

### 10.1 Errored sessions

8.0% of sessions (1,100 / 13,732) have at least one errored span. Top
error types (cell `fail-types`):

| Error | Count |
|---|---:|
| Recoverable exception | 842 |
| TransportQueryError | 478 |
| LLMProviderError | 366 |
| ArizeHostedLLMProviderError | 215 |
| BadRequestError | 121 |
| AuthenticationError | 109 |
| ToolNotFoundError (recoverable) | 106 |
| ValueError | 96 |
| TransportConnectionFailed | 92 |

### 10.2 Per-router error rate (cell `fail-by-router`)

| Router | Sessions | Error rate |
|---|---:|---:|
| CLUSTER_SUMMARY | 24 | 25% (small n) |
| **CUSTOM_EVAL** | **1,136** | **17%** |
| EXPERIMENT_SUMMARY | 624 | 15% |
| TASK_PAGE | 486 | 14% |
| CHAT | 2,225 | 12% |
| TRACE_AGENT | 1,061 | 8% |
| AQL | 138 | 6% |
| PROMPT_OPTIMIZATION | 4,182 | 6% |
| SEARCH | 1,212 | 5% |
| HOME_PAGE | 2,581 | 4% |

**CUSTOM_EVAL is the leakiest surface that has meaningful volume.**
Alyx-as-eval-author is a strong Pixie-eval target.

### 10.3 Retry-language follow-ups

(Cells `retry-phrases` / `retry-after-error`.) Refresh of predecessor's
"try again" / "fix my query" finding, expanded to a phrase set:

| Phrase | Matches | Distinct users |
|---|---:|---:|
| try again | 48 | 31 |
| wrong | 42 | 25 |
| fix this | 22 | 12 |
| fix my query | 19 | 15 |
| incorrect | 8 | 5 |

Predecessor reported `try again` 26× / 18 users. Current 48 / 31 — about
1.85× the predecessor count, in line with overall corpus growth.

**Crucially**, when Alyx errors users *almost never* retry:

|  | Value |
|---|---:|
| Sessions with ≥1 error | 1,100 |
| Sessions with ≥1 retry follow-up | 97 |
| Sessions with both | 35 |
| **P(retry \| error)** | **3.2%** |
| **P(error \| retry)** | **36%** |

Implication: retry-language is **specific but not sensitive**. Useful
for a precision-y eval rule (when a retry occurs, Alyx really did
likely err), bad as a primary failure-detection signal.

The 64% of retries with no recorded error are interesting in their own
right — Alyx "succeeded" (no error span) but the user wasn't satisfied.
Stage 3 candidate for a "silent-failure" use case.

### 10.4 Truncated trajectories

(Cell `truncated`.) **316 sessions (2.3%)** end with the last span
errored AND have at least one error overall. These are the "user got
an error and gave up" shape. Together with the retry-language signal
they cover ~3% of all sessions, so explicit failure detection (error
spans) remains the dominant lens.

## 11. Multi-turn arc heuristic (NEW — Layer 2)

(Cells `arc` / `arc-by-router`.) For each follow-up turn we classify
it relative to the prior turn as one of: retry / confirmation /
continuation / refinement / new / empty. Decision rules in
`detectors.classify_followup_turn`.

Across 16,075 follow-up turns (5,975 multi-turn sessions):

| Arc | Count | Share |
|---|---:|---:|
| **new question** | 9,712 | **60.4%** |
| empty (button-click) | 4,077 | 25.4% |
| refinement | 2,024 | 12.6% |
| confirmation | 138 | 0.9% |
| retry | 115 | 0.7% |
| continuation | 9 | 0.1% |

**Multi-turn is mostly serial new-questions, not refinement loops.**
This is the single most consequential finding of the report — most
synthetic agent evals are built around "user iteratively refines a
single objective" but in real Alyx traffic that's only 13% of
follow-up turns.

Per-router arc shares (cell `arc-by-router`):

| Router | new | empty | refinement | retry |
|---|---:|---:|---:|---:|
| SEARCH | 54% | 0% | 43% | 1% |
| HOME_PAGE | 86% | 1% | 11% | 0% |
| CHAT | 64% | 21% | 11% | 0% |
| PROMPT_OPTIMIZATION | 47% | 46% | 4% | 0% |
| TRACE_AGENT | 75% | 9% | 12% | 1% |
| AQL | 81% | 2% | 15% | 0% |

- **SEARCH is the only refinement-heavy router** (43%). Users search,
  inspect, refine query.
- **PROMPT_OPTIMIZATION is button-driven** (46% empty follow-ups).
- **HOME_PAGE follow-ups are basically all new questions** (86%) — fits
  its role as a session-entry surface.

## 12. Router transitions within sessions

(Cell `transition`.) **95.7%** of within-session transitions stay on
the same router. Top cross-router transitions (5,975 multi-turn
sessions, 16,075 transitions total):

| From | To | Count |
|---|---|---:|
| TRACE_AGENT | CHAT | 256 |
| CHAT | TRACE_AGENT | 246 |
| AQL | CHAT | 34 |
| CHAT | SEARCH | 15 |
| AQL | TRACE_AGENT | 14 |
| TRACE_AGENT | AQL | 13 |
| SEARCH | CHAT | 11 |

The TRACE_AGENT ↔ CHAT bidirectional pattern is the natural
"investigate then ask about it" workflow. Aside from that, surface
switching is rare.

## 13. Internal vs external trajectory differences (NEW)

(Cell `intext` / `intext-routers`.) Counter to the common assumption
that internal users dogfood harder, **external users drive longer /
tool-heavier / more errored sessions**:

|  | External | Internal |
|---|---:|---:|
| Sessions | 5,471 | 8,261 |
| Avg turns | 2.80 | 1.75 |
| Avg spans | 27.2 | 16.3 |
| Avg tool calls | 14.1 | 8.6 |
| Error rate | 9.9% | 6.7% |
| Median duration (min) | 0.65 | 0.55 |

Plausible explanation: internal users hit Alyx through
PROMPT_OPTIMIZATION (70% internal-skewed) which is mostly single-turn
dogfood, while external customers do real multi-step exploratory work
on CHAT/SEARCH/TRACE_AGENT.

Internal-skew per router (cell `intext-routers`):

| Router | Internal share |
|---|---:|
| PROMPT_OPTIMIZATION | 70% |
| TASK_PAGE | 70% |
| CUSTOM_EVAL | 58% |
| CHAT | 47% |
| HOME_PAGE | 36% |
| TRACE_AGENT | 32% |
| AQL | 28% |
| EXPERIMENT_SUMMARY | 23% |
| SEARCH | **10%** |

**SEARCH is essentially an external use case.** PROMPT_OPTIMIZATION
and TASK_PAGE are essentially internal. Stage 3 should respect this
split — within-router clustering will produce different findings than
cross-router clustering.

## 14. Stage 3 framing — recommendation

The data has clear views on each Stage 3 design question:

### 14.1 Grouping axis → **cluster within router type**

The router-type signal is free, ground-truth, and predictive of every
trajectory shape feature we measured (turns, tool calls, error rate,
arc distribution, internal/external skew). Cross-router clustering
would dilute these signals.

Recommendation:

- Primary axis: per-router clustering on Layer 1 query text.
- Secondary axis: per-router-per-org sub-clusters, but only for the
  top 5 orgs in each router — below that volumes are too small.
- Don't cluster globally.

### 14.2 Multi-turn collapse → **per-query, not per-session**

60% of follow-up turns are *new questions*, not refinements of the
previous one. Treating each session as a single use-case unit would
collapse genuinely different questions into the same cluster.

Recommendation: cluster on individual queries. Carry the
`session_id`/`turn_index` columns through so the catalog can show
"these queries appear as the 2nd turn of a session" / "these are
single-turn questions" if useful, but don't roll up.

The exception is SEARCH (43% refinement-heavy) — within SEARCH it
might be worth experimenting with collapsing a refinement chain to
the *first* query plus a "+ refinement" marker. Treat as a Stage 3
phase-2 question, not a default.

### 14.3 Internal traffic → **include with the flag, don't drop**

Three reasons:

1. PROMPT_OPTIMIZATION and TASK_PAGE are 70% internal — dropping
   internal would make these routers look ~3× smaller than they are
   in the user-visible product.
2. Internal usage of those surfaces *is* a valid use case (Arize team
   is a customer of its own product); we just need to label it.
3. The flag is free — it's already on every Layer 1 row.

Recommendation: keep all flagged rows in clustering inputs. Annotate
each use case with internal/external counts. When the catalog reports
"top use cases," use the external count.

### 14.4 Dedupe → **keep exact-match dedupe, drop seed-button matches**

The predecessor's "exact-match dedupe across sessions" is still right —
Alyx's seed-button matches contribute most of the duplication and we
flag those separately. After exact-match dedupe + seed-button drop:

- Layer 1 has 25,464 queries.
- Subtracting `is_seed_button_match` (4,768) leaves ~20.7k.
- Exact-match dedupe of those (predecessor saw ~10.7k unique) gets
  us to roughly 10.5k–11k unique non-seed-button queries.

That's a healthy clustering input.

### 14.5 NL-query agent → **build it (low cost, high leverage)**

The sandbox already has DuckDB registering all three layers as views
(`loaders.duckdb_connection()`). A Claude tool-use loop over that
connection is half a day of work and immediately turns the corpus
into an interactive instrument for Stage 3 question-answering ("show
me the longest sessions for org X where the agent erred", etc).

Cheap to scaffold; if it adds no value once Stage 3 lands we delete it
without regret.

## Open follow-ups for Stage 3

- Re-run Layer 2 with the `tool_name`/`tool_input` fix from
  `loaders.derive_tool_name` lifted into the pipeline. The notebook
  workaround is fine for analysis but Layer 2 should be self-correct.
- Investigate the "no error, but user retried" cohort (~62 sessions) —
  these are the silent-failure use case and should get their own Stage 3
  bucket.
- Pull weekly external-volume into a chart for the report (placeholder
  table only right now).

## Appendix — reproducibility

Every claim in this report is reproducible from
`notebooks/stage2-analysis.ipynb`:

```bash
cd ~/Projects/phoenix-clones/alyx-data/alyx-data
uv sync --extra notebook
uv run --extra notebook jupyter nbconvert \
    --to notebook --execute --inplace notebooks/stage2-analysis.ipynb
```

Cell IDs cited in the body: `corpus-inventory`, `drift`,
`router-table`, `weekly`, `monthly-internal`, `top-orgs`,
`top-org-router`, `turn-dist`, `lang`, `shape`, `tool-top`,
`tool-by-router`, `fail-types`, `fail-by-router`, `retry-phrases`,
`retry-after-error`, `truncated`, `transition`, `arc`,
`arc-by-router`, `intext`, `intext-routers`, `exemplars`.
