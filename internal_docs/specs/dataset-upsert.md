# Dataset Upsert via REST API

Authors: @xandersong

## What We Built

An **upsert action** for the `POST /v1/datasets/upload` REST endpoint that allows callers to declaratively sync a dataset to a desired state in a single request. Given a dataset name and a list of examples, the system diffs the incoming examples against the most recent version and produces the minimal set of CREATE, PATCH, and DELETE revisions needed to converge, then records them as a new dataset version.

### Key components

| Component | Location | Purpose |
|---|---|---|
| Upsert insertion logic | `src/phoenix/db/insertion/dataset.py` | Core diff algorithm, batch DB writes |
| REST router changes | `src/phoenix/server/api/routers/v1/datasets.py` | Accepts `action: "upsert"` on the upload endpoint |
| Content hashing | `src/phoenix/utilities/content_hashing.py` | SHA-256 over canonicalized JSON for deduplication |
| JCS vendor lib | `src/phoenix/vendor/json_canonicalization_scheme/` | RFC 8785 JSON Canonicalization Scheme |
| DB migration | `src/phoenix/db/migrations/versions/575aa27302ee_dataset_upsert.py` | Adds `external_id` and `content_hash` columns |

### API surface

The upload endpoint already supported two actions (`create`, `append`). This PR adds a third:

```
POST /v1/datasets/upload
Content-Type: application/json

{
  "action": "upsert",
  "name": "my-dataset",
  "inputs": [...],
  "outputs": [...],
  "metadata": [...],
  "example_ids": [...],    // optional, enables stable identity matching
  "splits": [...]           // optional
}
```

Behavior by action:

- **create** -- insert a new dataset; fail (409) if a dataset with that name already exists.
- **append** -- add examples to an existing dataset (or create it if missing). Always produces a new version.
- **upsert** -- diff incoming examples against the latest version. Create, patch, or delete examples as needed. Only produces a new version if something changed.

## Why We Built It

### The problem

Before this change, the only way to update a dataset was `append`, which blindly adds examples. There was no way to:

1. **Remove examples** that are no longer relevant.
2. **Update examples** whose content has changed without duplicating them.
3. **Avoid creating empty versions** when the dataset hasn't actually changed.

Teams that maintain datasets from external sources (annotation tools, data pipelines, CI) need a declarative "desired-state" primitive: "here is what the dataset should look like now -- figure out what changed."

### Design goals

- **Idempotent** -- uploading the same payload twice produces no new version and no duplicate data.
- **Minimal diffs** -- only the examples that actually changed get new revision records, keeping storage and audit history clean.
- **Backwards-compatible** -- the existing `create` and `append` paths are untouched. `upsert` is a new action value.
- **Two matching strategies** -- callers can use stable `external_id` values for explicit identity, or fall back to content-hash matching for implicit deduplication.

## How It Works

### Content hashing

Each example's `input`, `output`, and `metadata` dicts are combined into a single object `{"input": ..., "metadata": ..., "output": ...}`, serialized via the JSON Canonicalization Scheme (RFC 8785, key-order-independent, deterministic number formatting), and then SHA-256 hashed. This hash is stored on the revision row (`content_hash` column) and used for matching.

Properties:
- Deterministic: same logical content always produces the same hash.
- Key-order independent: `{"a": 1, "b": 2}` == `{"b": 2, "a": 1}`.
- List-order sensitive: `[1, 2, 3]` != `[3, 2, 1]`.
- Only `input`/`output`/`metadata` participate -- `splits`, `span_id`, and `external_id` do not affect the hash.

### Diff algorithm (`_diff_examples`)

Given incoming examples and the previous version's examples (with their `external_id` and `content_hash`), each incoming example is matched to a previous example using a two-tier priority:

1. **external_id match** (highest priority) -- if the incoming example has an `external_id` and a previous example shares it, they are paired regardless of content.
2. **content_hash match** -- if no external_id match, pair with the first unmatched previous example that shares the same content hash.
3. **No match** -- the incoming example is new.

After matching, the classification is:

| Incoming | Previous | Result |
|---|---|---|
| Matched, same hash | -- | **Unchanged** (no revision, carried forward implicitly) |
| Matched, different hash | -- | **PATCH** revision |
| No match | -- | **CREATE** revision (new example row + revision) |
| -- | Unmatched | **DELETE** revision |

If no creates, patches, or deletes exist, the latest version ID is reused and no new version is created.

### Split handling

Two modes based on whether splits were provided in the request:

- **splits_provided=True**: All existing split assignments for the dataset are deleted and rebuilt from the incoming examples. This guarantees splits match exactly what the caller specified.
- **splits_provided=False**: Only split assignments for deleted examples are removed. Surviving examples keep their current split assignments.

### Schema changes

The migration adds two columns:

- `dataset_examples.external_id` (VARCHAR, nullable) with a unique constraint on `(dataset_id, external_id)` -- at most one example per external_id per dataset.
- `dataset_example_revisions.content_hash` (VARCHAR, nullable) -- the SHA-256 hex digest. Indexed for efficient lookups.

## Edge Cases

### Duplicate example_ids in a single request
Rejected with a validation error before any DB writes. The REST layer checks for duplicates using a `Counter` and raises 422 if any example_id appears more than once.

### Upsert on a non-existent dataset
Creates the dataset first, then treats all incoming examples as CREATEs (there is no previous version to diff against).

### Upsert on a dataset with no prior versions
Same behavior as a non-existent dataset -- all incoming examples are CREATEs.

### Two incoming examples with identical content but no external_id
The first one matches the existing example by content hash (unchanged). The second one finds no unmatched previous example and is classified as a CREATE. This is correct: the diff algorithm tracks which previous examples have already been matched via the `already_matched` set.

### External_id present on incoming but not on previous (or vice versa)
Matching gracefully degrades: if the incoming example has an external_id but no previous example shares it, content-hash matching is attempted. If a previous example has an external_id but no incoming example references it, the previous example is unmatched and becomes a DELETE.

### Re-adding a previously deleted example
If an example was deleted in a prior upsert and then re-uploaded with the same `external_id`, the existing `dataset_example` row is reused (looked up via `_get_existing_example_ids`) rather than creating a duplicate row. A new CREATE revision is attached to the existing example row.

### Empty upsert payload
If no examples are provided, all previous examples become DELETEs (the dataset is cleared).

### Missing span_ids
Logged as a warning. Examples are created without span links. This is non-fatal because span linking is optional.

### Race conditions in split creation
Handled with `ON CONFLICT DO NOTHING` so concurrent requests creating the same split name don't fail.

### Length mismatches
The REST layer validates that `inputs`, `outputs`, `metadata`, `splits`, `span_ids`, and `example_ids` arrays are all the same length (when provided). Mismatches raise 422.

### No-op upsert (content unchanged)
When all incoming examples match previous examples with identical hashes, no new version is created. The response returns the existing latest version ID.

## Future Work

### Batch upsert revisions
Currently, PATCH and DELETE revisions during upsert are inserted one at a time via `insert_dataset_example_revision`. For large datasets with many changes, this should be batched (the bulk insert functions already exist for the CREATE/APPEND paths).

### Partial upsert / merge semantics
The current upsert is "full replace" -- any example in the previous version that is not in the incoming batch gets deleted. A `merge` action could add/update without deleting, useful for incremental pipelines that only know about a subset of examples.

### Streaming / chunked upload
For very large datasets (100k+ examples), a streaming upload protocol would avoid loading the entire payload into memory. This could use chunked transfer encoding or a multi-part upload with pagination.

### Content hash on legacy data
Existing datasets created before this migration have `NULL` content hashes. A backfill migration or lazy-computation strategy would let upsert work against legacy datasets without requiring a one-time recompute.

### Conflict resolution strategies
Currently, external_id conflicts within a single request are rejected. Alternative strategies (last-write-wins, merge fields) could be offered as options.

### Webhook / event notifications
Publishing dataset change events (creates, patches, deletes) to an event bus or webhook would let downstream systems react to dataset updates (e.g., triggering re-evaluation).

### Client SDK support
The `phoenix-client` Python/TS SDK should expose an `upsert_dataset()` method that wraps the REST call, handles batching, and provides a clean API for programmatic dataset management.
