# Dataset Upload REST API

Authors: @xandersong

## What We Built

The `POST /v1/datasets/upload` REST endpoint accepts three explicit actions:
`create`, `append`, and `update`. Each maps to a distinct "what happens when a
dataset with this name already exists" semantics, so there is no hidden mode
flag.

### Key components

| Component | Location | Purpose |
|---|---|---|
| Insertion logic | `src/phoenix/db/insertion/dataset.py` | Diff algorithm, batch DB writes |
| REST router | `src/phoenix/server/api/routers/v1/datasets.py` | Dispatches action to the insertion layer |
| Content hashing | `src/phoenix/utilities/content_hashing.py` | SHA-256 over canonicalized JSON for deduplication |
| JCS vendor lib | `src/phoenix/vendor/json_canonicalization_scheme/` | RFC 8785 JSON Canonicalization Scheme |
| DB migration | `src/phoenix/db/migrations/versions/575aa27302ee_dataset_upsert.py` | Adds `external_id` and `content_hash` columns |

### API surface

```
POST /v1/datasets/upload
Content-Type: application/json

{
  "action": "create" | "append" | "update",
  "name": "my-dataset",
  "inputs": [...],
  "outputs": [...],
  "metadata": [...],
  "example_ids": [...],    // optional, enables stable identity matching
  "splits": [...]           // optional
}
```

Behavior by action:

- **create** — fail with **409** if a dataset with the given name already
  exists. Otherwise create the dataset and insert all incoming examples as
  CREATE revisions.
- **append** — add incoming examples to an existing dataset (auto-creates the
  dataset if missing). Dedupes against the latest version by `external_id` or
  content hash; patches when a matched example's content has changed. Never
  deletes existing examples.
- **update** — declarative reconcile against the latest version.
  Creates, patches, or deletes examples as needed so the dataset converges on
  the incoming payload. Auto-creates the dataset if missing. Only emits a new
  version when something actually changed.

The two SDK clients (`arize-phoenix-client` Python / JS) expose only `update`
and `append` on their low-level `action` parameter. `create` is a REST-only
verb used by the Phoenix UI's "Create Dataset" button to get the 409 safety
behavior.

### Client fallback for older servers

When a client sends `action=update` to a Phoenix server that predates this
change, the server returns **422** with body `"Invalid dateset action: update"`
(the typo is part of the server's enum error). Clients detect this specific
response, emit a warning, and automatically retry the same request with
`action=create`. On those older servers, `action=create` with the default
`strict=false` had the permissive upsert behavior, so the fallback preserves
the declarative semantics — minus the 409-on-name-conflict safety.

## Why We Built It

### The problem

Before this change, the only write actions were `create` (blind insert) and
`append` (blind add). There was no way to:

1. **Remove examples** that are no longer relevant.
2. **Update examples** whose content has changed without duplicating them.
3. **Avoid creating empty versions** when the dataset hasn't actually changed.

Teams that maintain datasets from external sources (annotation tools, data
pipelines, CI) need a declarative "desired-state" primitive: "here is what the
dataset should look like now — figure out what changed." That is `update`.

At the same time, interactive UI flows want the explicit "I am creating a new
dataset; stop me if the name is taken" safety behavior. That is `create`.

### Design goals

- **Idempotent** — uploading the same `update` payload twice produces no new
  version and no duplicate data.
- **Minimal diffs** — only the examples that actually changed get new revision
  records, keeping storage and audit history clean.
- **Two matching strategies** — callers can use stable `external_id` values for
  explicit identity, or fall back to content-hash matching for implicit
  deduplication.
- **One verb per behavior** — no hidden mode flags.

## How It Works

### Content hashing

Each example's `input`, `output`, and `metadata` dicts are combined into a
single object `{"input": ..., "metadata": ..., "output": ...}`, serialized via
the JSON Canonicalization Scheme (RFC 8785, key-order-independent,
deterministic number formatting), and then SHA-256 hashed. This hash is stored
on the revision row (`content_hash` column) and used for matching.

Properties:
- Deterministic: same logical content always produces the same hash.
- Key-order independent: `{"a": 1, "b": 2}` == `{"b": 2, "a": 1}`.
- List-order sensitive: `[1, 2, 3]` != `[3, 2, 1]`.
- Only `input`/`output`/`metadata` participate — `splits`, `span_id`, and
  `external_id` do not affect the hash.

### Diff algorithm (`_diff_examples`)

Given incoming examples and the previous version's examples (with their
`external_id` and `content_hash`), each incoming example is matched to a
previous example using a two-tier priority:

1. **external_id match** (highest priority) — if the incoming example has an
   `external_id` and a previous example shares it, they are paired regardless
   of content.
2. **content_hash match** — if no external_id match, pair with the first
   unmatched previous example that shares the same content hash.
3. **No match** — the incoming example is new.

After matching, the classification is:

| Incoming | Previous | Result |
|---|---|---|
| Matched, same hash | — | **Unchanged** (no revision, carried forward implicitly) |
| Matched, different hash | — | **PATCH** revision |
| No match | — | **CREATE** revision (new example row + revision) |
| — | Unmatched | **DELETE** revision (skipped for `append`) |

If no creates, patches, or deletes exist, the latest version ID is reused and
no new version is created.

### Split handling

Two modes based on whether splits were provided in the request:

- **splits_provided=True**: All existing split assignments for the dataset are
  deleted and rebuilt from the incoming examples (for `create` and `update`).
  For `append`, only the touched examples have their assignments rebuilt;
  untouched examples keep their current splits.
- **splits_provided=False**: Split assignments are preserved for surviving
  examples. Only deleted examples lose their assignments.

### Schema changes

The migration adds two columns:

- `dataset_examples.external_id` (VARCHAR, nullable) with a unique constraint
  on `(dataset_id, external_id)` — at most one example per external_id per
  dataset.
- `dataset_example_revisions.content_hash` (VARCHAR, nullable) — the SHA-256
  hex digest. Indexed for efficient lookups.

## Edge Cases

### Duplicate example_ids in a single request
Rejected with a validation error before any DB writes. The REST layer checks
for duplicates using a `Counter` and raises 422 if any example_id appears more
than once.

### `create` on an existing name
Raises `DatasetNameConflictError` → **409**. The request is rejected before any
writes; no partial state is left behind.

### `update` or `append` on a non-existent dataset
Creates the dataset first, then treats all incoming examples as CREATEs (there
is no previous version to diff against).

### Two incoming examples with identical content but no external_id
The first one matches the existing example by content hash (unchanged). The
second one finds no unmatched previous example and is classified as a CREATE.
This is correct: the diff algorithm tracks which previous examples have
already been matched via an `already_matched` set.

### External_id present on incoming but not on previous (or vice versa)
Matching gracefully degrades: if the incoming example has an external_id but
no previous example shares it, content-hash matching is attempted. If a
previous example has an external_id but no incoming example references it,
the previous example is unmatched — becomes a DELETE under `update` and is
ignored under `append`.

### Re-adding a previously deleted example (with same external_id)
The existing `dataset_example` row is reused (looked up via
`_get_existing_example_ids`) rather than creating a duplicate row. A new
CREATE revision is attached to the existing example row.

### Empty `update` payload
All previous examples become DELETEs; the dataset is effectively cleared (a
new version is created with the corresponding DELETE revisions).

### Missing span_ids
Logged as a warning. Examples are created without span links. This is
non-fatal because span linking is optional.

### Race conditions in split creation
Handled with `ON CONFLICT DO NOTHING` so concurrent requests creating the
same split name don't fail.

### Length mismatches
The REST layer validates that `inputs`, `outputs`, `metadata`, `splits`,
`span_ids`, and `example_ids` arrays are all the same length (when provided).
Mismatches raise 422.

### No-op `update` (content unchanged)
When all incoming examples match previous examples with identical hashes, no
new version is created. The response returns the existing latest version ID
and zero counts.

## Future Work

### Batch PATCH/DELETE revisions
Currently, PATCH and DELETE revisions are inserted one at a time via
`insert_dataset_example_revision`. For large datasets with many changes, this
should be batched (the bulk insert functions already exist for the
CREATE/APPEND paths).

### Partial merge semantics
The `update` action is "full replace" — any example in the previous version
that is not in the incoming batch gets deleted. A `merge` action could
add/update without deleting, useful for incremental pipelines that only know
about a subset of examples.

### Streaming / chunked upload
For very large datasets (100k+ examples), a streaming upload protocol would
avoid loading the entire payload into memory.

### Content hash on legacy data
Existing datasets created before the content-hash migration have `NULL`
content hashes. A backfill migration or lazy-computation strategy would let
`update` work against legacy datasets without requiring a one-time recompute.

### Webhook / event notifications
Publishing dataset change events (creates, patches, deletes) to an event bus
or webhook would let downstream systems react to dataset updates (e.g.,
triggering re-evaluation).
