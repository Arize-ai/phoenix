# alyx-data — filter rules (Layer 1)

This document describes how Layer 1 of the alyx-data pipeline turns extracted
user-query rows into the canonical `data/clean/user-queries.parquet`.

## TL;DR

- **Hard validity drop:** rows where `is_empty == True` (query text shorter
  than `cfg.min_query_chars`, default 3 characters after normalization).
- **Everything else stays.** Internal users, trivial queries, naked
  identifiers, and seed-button matches are kept as flagged rows. Stages 2
  and 3 of the alyx-data project (analysis report and use-case extraction)
  decide what to do with each flag.

This is the key behavioral difference vs. the predecessor `pxi-eval-dataset`
pipeline, which dropped all of these rows. Stage 1's job is to produce a
canonical Layer 1 that's "every parseable user query Alyx received,"
preserving as much signal as possible for downstream judgment calls.

## Normalization

Used by `is_empty`, `is_trivial`, and `is_seed_button_match`:

```
query_norm = WHITESPACE.sub(" ", query_text.strip().lower())
```

i.e. trim, lowercase, collapse runs of whitespace.

## Flag definitions

### `is_internal: bool`

**True if** `user_email.lower().endswith(d)` for any
`d in cfg.internal_email_domains` (default: `("@arize.com",)`).

**Fallback:** True if `user_email` is null AND `org_name` is in
`cfg.internal_org_names` (default: `()` — empty; refine after inspecting
Layer 1 output).

Why a flag and not a drop: internal queries are valuable signal for
understanding Alyx usage among power users. They may be over- or under-
representative depending on the question being asked, but that's an
analysis-time decision (Stage 2/3), not a Layer 1 decision.

### `is_empty: bool`  *(HARD DROP)*

**True if** `len(query_norm) < cfg.min_query_chars` (default: 3 chars).

This is the only validity filter. Rows where this is True have no usable
query text, so no downstream stage can recover signal from them. They are
dropped at Layer 1 to keep the canonical dataset honest about what "a user
query" means.

### `is_trivial: bool`

**True if** `query_norm in cfg.trivial_queries`.

`cfg.trivial_queries` defaults to:

```
{"test", "hello", "hi", "hey", "asdf", "qwerty",
 "ok", "yes", "no", "thanks", "ty"}
```

These are clearly not real Alyx interactions — they're either testing the
chat box, follow-up acknowledgements, or exploratory keystrokes. But:
- Stage 2 ("what do users actually ask Alyx?") may want them excluded.
- Stage 3 ("agent failure modes") may want them included to catch bugs in
  how Alyx handles greetings / acknowledgements / empty turns.

So we flag and let downstream choose.

### `is_naked_identifier: bool`

**True if** the trimmed query matches any of these patterns end-to-end:

| Pattern | Matches |
|---|---|
| `^s3://\S+$` | S3 URI |
| `^https?://\S+$` | bare URL |
| `^[a-f0-9]{16,}$` | long hex hash |
| UUID v4 shape | bare UUID |
| `^[\w.+-]+@[\w-]+\.[\w.-]+$` | bare email |
| `^\d{5,}$` | bare 5+ digit number |

These are SEARCH-style lookup payloads — the user pasted an ID into the
chat box. Alyx's router routes them to the SEARCH surface; they are usually
not natural-language questions but they ARE legitimate Alyx interactions.

Stage 2 reports may want to exclude them when discussing question-answering
patterns; Stage 3 may want to include them when discussing how the SEARCH
surface handles malformed IDs.

### `is_seed_button_match: bool`

**True if** `query_norm` appears as a *first-turn* query (`turn_index == 0`)
across at least `cfg.seed_query_min_distinct_users` distinct `user_id`s
(default: 5).

This is a heuristic for catching landing-page "canned suggestion" buttons
that drop a fixed prompt into the chat box. Predecessor evidence: ~5% of
queries in the 90-day window matched this signature.

Companion column `seed_distinct_first_turn_users: Int64` carries the actual
distinct-user count so downstream stages can tune the threshold without
re-running Layer 1.

This flag is necessarily approximate — a popular real question can also
trigger it. Stage 2 / Stage 3 should treat it as a strong hint, not a
verdict.

## Why these aren't drops

The predecessor `pxi-eval-dataset/eval-dataset` pipeline dropped each of
these in its `filter.py`. That made sense for its goal (curate a clean seed
query bank for Pixie). For alyx-data Stage 1, the goals are different:

1. **Stage 2** wants to write an analysis report on the full Alyx workload.
   Throwing out internal users or seed-button matches would bias the
   report's denominators.
2. **Stage 3** wants to extract use-case clusters and failure modes. Some
   "trivial" or "naked identifier" queries are actually failure modes Alyx
   should handle better, and dropping them at Layer 1 would hide that
   signal.
3. **Reproducibility.** A flagged row is recoverable; a dropped row is
   gone. We'd rather rebuild than re-export.

## Sanity expectations (from predecessor 90-day run)

Pipeline funnel, expected order of magnitude:

| Stage | Rows |
|---|---|
| Raw spans (Layer 0) | ~388k |
| → root AGENT spans / user queries (Layer 1a) | ~24k |
| → after `is_empty` drop (Layer 1b) | ~24k (drop is < 1%) |

Of the ~24k Layer 1 rows, predecessor distributions:

| Flag | Approx share |
|---|---|
| `is_internal` | ~50% (all `@arize.com` accounts) |
| `is_trivial` | ~1% |
| `is_naked_identifier` | ~3% |
| `is_seed_button_match` | ~5% |

The 2-day probe run on 2026-04-29 → 2026-05-01 saw `is_internal == 27%` —
lower than the 90-day average because the probe window happened to include
more external customer activity. The 90-day expectation is the more
reliable baseline.

## Configuration

All thresholds and lists live in `src/pipeline/config.py` under the
constants:

- `INTERNAL_EMAIL_DOMAINS`
- `INTERNAL_ORG_NAMES`
- `MIN_QUERY_CHARS`
- `TRIVIAL_QUERIES`
- `SEED_QUERY_MIN_DISTINCT_USERS`

Updating any of these and re-running `--from-step flag` regenerates Layer
1b without re-hitting the Arize API.
