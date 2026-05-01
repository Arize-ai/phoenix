# alyx-data — data schema

This document covers the three layered artifacts produced by Stage 1 of the
alyx-data project.

| Layer | Path                                                  | Granularity        |
|-------|-------------------------------------------------------|--------------------|
| 0     | `data/raw/copilot-prod-spans-<window>/chunk_*.parquet`| span (raw)         |
| 1a    | `data/clean/user-queries-extracted.parquet`           | user query         |
| 1b    | `data/clean/user-queries.parquet`                     | user query + flags |
| 2a    | `data/trajectories/spans.parquet`                     | span (projected)   |
| 2b    | `data/trajectories/sessions.parquet`                  | session            |

Source provenance: all data originates from Arize space `Space:7192:xWT5`,
project `copilot-prod` (the Alyx production model). The export uses the
Arize SDK v8 `ArizeClient.spans.export_to_df` API.

---

## Layer 0 — raw spans

`data/raw/copilot-prod-spans-<start>_to_<end>/chunk_<start>_<end>.parquet`

One row per OpenInference span. The export is chunked into 14-day windows so
no single API call has to materialize the full 90-day corpus, and so the
process never holds more than one chunk in memory.

### Why a column whitelist?

The full Arize span shape has ~65 columns, several of which are heterogeneous
nested-object types (e.g. `attributes.llm.prompt_template.variables`). When
pyarrow tries to serialize those object columns it fails with the
`cannot mix list and non-list` error — this took down attempt 2 of the
predecessor's 90-day run. The whitelist below avoids the failure mode and
also reduces on-disk size by ~3×.

This whitelist is a superset of the predecessor's: Layer 2 needs span outputs
and tool/LLM telemetry that Layer 1 never looked at.

### Columns

| Column | Source / meaning |
|---|---|
| `context.trace_id` | OpenTelemetry trace ID. Stable per Alyx interaction; multiple agent turns inside a UI session share a `session.id` but each has its own `trace_id`. |
| `context.span_id` | Span ID. |
| `parent_id` | Parent span ID. NULL for root agent spans. |
| `name` | Span name. Root agent spans are named `ROUTER-<CATEGORY>` (e.g. `ROUTER-CHAT`, `ROUTER-SEARCH`). |
| `attributes.openinference.span.kind` | One of `AGENT`, `LLM`, `TOOL`, `RETRIEVER`, `CHAIN`, … |
| `attributes.input.value` | Span input. For root agent spans, a JSON envelope `{type:"user_input", question, input_context}`. |
| `attributes.output.value` | Span output. |
| `attributes.input.mime_type` | MIME type of the input value. |
| `attributes.output.mime_type` | MIME type of the output value. |
| `attributes.metadata` | Dict carrying per-trace context: `arize_user_email`, `arize_org_id`, `arize_org_name`, `arize_account_name`, `copilot_router_type`, `current_page_url`, … |
| `attributes.session.id` | Alyx UI session identifier. May be NULL on some root spans (predecessor noted this). |
| `attributes.user.id` | User identifier (Arize internal). |
| `start_time` / `end_time` | Span timing (UTC). |
| `status_code` / `status_message` | OTel status. |
| `latency_ms` | Span latency from Arize. |
| `attributes.tool.name` / `.parameters` / `.description` | Tool-call telemetry, populated when `kind == "TOOL"`. |
| `attributes.llm.model_name` / `.provider` / `.system` | LLM identity, populated when `kind == "LLM"`. |
| `attributes.llm.token_count.{prompt,completion,total}` | Token counts. |
| `attributes.llm.prompt_template.template` / `.version` | Prompt template metadata. |
| `attributes.retrieval.documents` | Retrieved documents, populated when `kind == "RETRIEVER"`. |
| `events` | OTel events array — error/exception events live here. |

Each chunk parquet sits alongside `_manifest.json` listing
`{path, start, end, rows}` per chunk so re-runs can verify completeness
without scanning files.

---

## Layer 1 — user queries with scope flags

### 1a. `data/clean/user-queries-extracted.parquet` (intermediate)

One row per user query. Built by `extract.py` from the raw layer by selecting
root AGENT spans whose `name` starts with `ROUTER-` and parsing
`attributes.input.value.question`.

Columns:

| Column | Type | Source / meaning |
|---|---|---|
| `query_text` | str | The user's natural-language question (`.question` from input JSON). |
| `router_type` | str | `metadata.copilot_router_type`, falling back to `name` minus `ROUTER-`. |
| `router_name` | str | The raw `name` (`ROUTER-CHAT`, `ROUTER-SEARCH`, …). |
| `trace_id` | str | OpenTelemetry trace ID. |
| `session_id` | str \| None | Alyx UI session ID; can be null. |
| `user_id` | str \| None | Arize user ID. |
| `user_email` | str \| None | `metadata.arize_user_email`. |
| `org_id` / `org_name` / `account_name` | str \| None | Arize org / account context. |
| `current_page_url` | str \| None | Page the query was issued from. |
| `turn_index` | Int64 | 0-indexed turn within session, ordered by timestamp. |
| `timestamp` | datetime64[ns, UTC] | Span start time. |
| `raw_input_value` | str | Raw input JSON for forensic / re-parse use. |
| `source_span_id` | str | Source span's `context.span_id` for joining back to Layer 0 / Layer 2 spans. |

### 1b. `data/clean/user-queries.parquet` (canonical)

Same as 1a, with five boolean flag columns and one helper column added by
`flag.py`. **The only validity drop is `is_empty`.** All other rows survive
to Layer 1 with their flags set; downstream stages decide what to do with
them.

| Column added | Type | Definition |
|---|---|---|
| `query_norm` | str | `str.strip().lower()` with collapsed whitespace. Helper for flag predicates and downstream dedupe. |
| `is_internal` | bool | `user_email` ends in any `cfg.internal_email_domains` (default: `@arize.com`). Falls back to `org_name in cfg.internal_org_names` when email is null. |
| `is_empty` | bool | `len(query_norm) < cfg.min_query_chars` (default: 3). **Hard-dropped at Layer 1.** |
| `is_trivial` | bool | `query_norm in cfg.trivial_queries` (`test`, `hello`, …). |
| `is_naked_identifier` | bool | Query is entirely a UUID / S3 URI / URL / hex hash / email / 5+ digit number. |
| `is_seed_button_match` | bool | First-turn query that appears across ≥ `cfg.seed_query_min_distinct_users` (default: 5) distinct `user_id`s. Heuristic for landing-page canned-suggestion buttons. |
| `seed_distinct_first_turn_users` | Int64 | Distinct user count for the heuristic; null where N/A. |

See `docs/filter-rules.md` for the full rule definitions and rationale for
why scope drops live in Stages 2/3 instead of here.

---

## Layer 2 — trajectories

Two parquets keyed by `(session_id, trace_id, span_id)` so reconstructing a
single Alyx interaction is a `WHERE session_id = ?` query.

### Storage shape decision

The plan listed three options for storing trajectories:

1. Single parquet with a serialized JSON column for `traces`.
2. Two parquets: `sessions.parquet` (flat session metadata) +
   `spans.parquet` (one row per span).
3. JSONL fallback.

**We picked option 2.** Reasons:

- Pandas + pyarrow handle nested `list[struct]` columns, but the inner
  structs need a uniform schema. Spans here have very heterogeneous
  attributes (LLM, TOOL, RETRIEVER, AGENT, CHAIN, …). Forcing them all into
  one struct would either lose information or require JSON-encoding the raw
  attrs anyway — at which point the column is opaque.
- A flat `spans.parquet` keyed by `(session_id, trace_id, span_id)` is
  SQL/DuckDB-friendly, pyarrow predicate-pushdown works, and reconstructing
  one session is `spans.loc[spans.session_id == sid]`.
- `sessions.parquet` stays small (~3.8k rows for 90 days) and is safe to
  load fully into memory for cross-session aggregations.

### `data/trajectories/spans.parquet`

One row per span. Memory-streamed: chunks read one at a time, each chunk's
projected records appended via `pyarrow.parquet.ParquetWriter` so we never
hold the corpus in memory.

| Column | Type | Meaning |
|---|---|---|
| `session_id` | str \| None | Alyx UI session. |
| `trace_id` | str | OpenTelemetry trace. |
| `span_id` | str | OpenTelemetry span. |
| `parent_id` | str \| None | Parent span; null for root agent spans. |
| `name` | str | Span name. |
| `kind` | str | `AGENT` / `LLM` / `TOOL` / `RETRIEVER` / `CHAIN` / … |
| `user_id` / `user_email` / `org_id` / `org_name` | str \| None | Identity, sourced from `attributes.metadata`. |
| `start_time` / `end_time` | timestamp[us, UTC] | Span timing. |
| `duration_ms` | float | `end - start` in milliseconds. |
| `status_code` / `status_message` | str \| None | OTel status. |
| `input_value` / `output_value` | str \| None | Span I/O, **truncated** to `cfg.trajectory_text_trunc_chars` (default 8000). Full text is always available in Layer 0. |
| `tool_name` / `tool_input` / `tool_output` | str \| None | TOOL-span specific I/O. `tool_input` is `attributes.tool.parameters` JSON-serialized; `tool_output` is the span's output value. |
| `llm_model` / `llm_provider` | str \| None | LLM-span identity. |
| `llm_token_count_{prompt,completion,total}` | Int64 \| None | LLM token counts. |
| `llm_prompt_template_version` | str \| None | Prompt template version. |
| `has_error` | bool | True if the span has an OTel `exception` event. |
| `error` | str \| None | `<type>: <message>` summary from the exception event. |
| `raw_attrs_json` | str \| None | All `attributes.*` columns JSON-serialized, truncated at `4 × trunc`. Forensic fallback for Layer 2 analyses we haven't thought of yet. |

### `data/trajectories/sessions.parquet`

One row per session. Built by aggregating `spans.parquet` (per-session
counters/timings) and then re-streaming the raw chunks once more to pick up
identity + ordered query texts from root AGENT spans.

| Column | Type | Meaning |
|---|---|---|
| `session_id` | str | Alyx UI session ID. |
| `user_id` / `user_email` | str \| None | Identity (first non-null seen on a root span). |
| `org_id` / `org_name` | str \| None | Org context. |
| `is_internal` | bool | Any root span had an internal email. |
| `trace_count` | int | Distinct trace IDs in the session. |
| `turn_count` | int | Number of root agent spans (= user turns). |
| `span_count` | int | Total spans across all traces. |
| `error_count` | int | Spans with `has_error`. |
| `start_time` / `end_time` / `duration_ms` | timestamp \| float | Session-wide timing. |
| `trace_ids` | list[str] | Trace IDs in chronological order. |
| `router_type_sequence` | list[str] | Each turn's router name in order — useful for "did the user switch surfaces mid-session?". |
| `query_sequence` | list[str] | Each turn's user-query text in order. Mirrors Layer 1's `query_text` for queries belonging to this session, but stays self-contained so trajectory consumers don't need to join Layer 1. |

### Reconstruction recipes

**Reconstruct one session** (single user, one Alyx UI conversation):

```python
import pandas as pd

sessions = pd.read_parquet("data/trajectories/sessions.parquet")
spans    = pd.read_parquet("data/trajectories/spans.parquet")

sid  = sessions.loc[sessions["turn_count"] >= 3, "session_id"].iloc[0]
sess = sessions.loc[sessions["session_id"] == sid].iloc[0]
sps  = (
    spans.loc[spans["session_id"] == sid]
         .sort_values(["start_time"])
)

print(sess[["user_email", "turn_count", "query_sequence"]])
print(sps[["kind", "name", "tool_name", "input_value"]].head(20))
```

**Pull all tool calls in a date range:**

```python
spans = pd.read_parquet(
    "data/trajectories/spans.parquet",
    filters=[("kind", "==", "TOOL"),
             ("start_time", ">=", "2026-04-01"),
             ("start_time", "<",  "2026-04-15")],
)
spans["tool_name"].value_counts()
```

**Find sessions that errored:**

```python
sessions[sessions["error_count"] > 0]
```

### Gotchas

- **Not every span is an Alyx user interaction.** The `copilot-prod`
  project receives spans from sources beyond the Alyx agent — observed in
  the 2-day probe:
  - GraphQL query spans (`name LIKE 'GQL query %'`) emitted by Phoenix
    frontend code under the same OTel context.
  - `copilot.persist_message_internal` infrastructure spans with empty
    `kind` (no OpenInference span.kind set).

  These spans do not have `attributes.session.id` and don't appear in
  `sessions.parquet`. They still land in `spans.parquet` for
  completeness. **In the 2-day probe ~22% of raw spans had null
  `session_id` for this reason**; the 90-day distribution is similar.
  To get only Alyx interaction spans:
  `spans.loc[spans.session_id.notna() & (spans.kind != "")]`.

- **Null `session_id` on Alyx root spans.** Beyond the non-Alyx noise
  above, a small fraction of legitimate Alyx traces also lack
  `attributes.session.id` (the predecessor noted this). Those degrade
  gracefully to per-trace rows: their spans appear in `spans.parquet`
  but the trace doesn't roll up to a session row.

- **Truncation.** `input_value` / `output_value` / `raw_attrs_json` are
  truncated. The truncation marker is the literal substring
  `"... [truncated N chars]"`. For full text, join back to Layer 0 by
  `(trace_id, span_id)`.

- **`raw_attrs_json` is for emergencies.** It's a stringified dict. Don't
  parse it as a hot path; if a particular attribute matters, lift it to a
  first-class column in `_row_to_span` and rebuild Layer 2.

- **`error_count == 0` on the 2-day probe.** Either Alyx had a clean 2-day
  window or our error detection (looking for OTel `exception` events) is
  too narrow. The 90-day run is the better signal — re-validate
  `has_error` distributions against it before relying on the column.
