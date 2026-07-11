# Editable Table System

Status: implemented first slice for dataset examples

## Problem

Phoenix needs table building blocks that can edit large, server-backed datasets
without copying every loaded row into React component state or rendering every
loaded row. A user must be able to enter an edit session, change individual
cells, append rows, delete rows, review the resulting diff, and commit the whole
session as one dataset version.

The first consumer is the dataset examples page. Its `input`, `output`, and
`metadata` columns are editable JSON objects. Split assignments remain
read-only, as do the IDs of persisted examples; a new example may carry an
optional custom ID.

## Goals

- Keep typing and row actions responsive with thousands of loaded rows.
- Mount only the visible row window while retaining loaded server pages.
- Load more server pages without replacing or losing local edits.
- Make editability opt-in per column/cell.
- Keep the edit engine independent of Relay and dataset semantics.
- Track creates, updates, and deletes as a compact diff.
- Commit a save atomically as exactly one dataset version.
- Keep invalid JSON out of the edit diff and block invalid saves.
- Preserve TanStack Table as the headless table and column model.

## Non-goals for the first slice

- Formula evaluation, fill handles, multi-cell paste, or range editing.
- Editing the ID of a persisted example, or editing split assignments.
- Reordering persisted examples.
- Offline persistence of an edit session.
- Merging concurrent edits from two users.
- Fetching an arbitrary cursor window around a server row. The first consumer
  starts at the beginning and cursor-loads forward; users can scroll both ways
  through all pages retained by Relay.

## Architecture

```text
Relay cursor pages                  Local edit session
(server baseline rows)             (sparse Zustand store)
          |                                  |
          +-------------+--------------------+
                        |
                 TanStack Table
            columns, sizing, row model
                        |
                 TanStack Virtual
             visible rows + overscan only
                        |
              composable cell renderers
       readonly / JSON editor / row actions
                        |
                 atomic save diff
                        |
            patchDatasetExamples
            one transaction + version
```

### 1. Sparse edit-session store

Location: `app/src/components/table/editing/`

The reusable store is created once per table instance and is not a global
store. It contains:

- `mode`: `read`, `editing`, or `saving`.
- `updatedRows`: sparse `rowId -> columnId -> value` patches.
- `addedRows`: complete client-created rows with stable temporary IDs.
- `deletedRowIds`: IDs of baseline rows hidden by the edit session.
- cell validation errors.
- actions to begin, update, add, delete, restore, cancel, and finish editing.

Baseline server rows stay in Relay/TanStack data. The store never clones the
full dataset. Updating one cell replaces only that row's sparse patch. A cell
subscribes to its own value and dirty bit, so an edit does not require every
row or every cell to render.

The store removes a patch when the edited value is deeply equal to its baseline
value. Deleting a newly added row removes the create instead of producing a
create-and-delete pair. Deleting an existing row suppresses any update for that
row in the emitted diff.

The serializable diff is:

```ts
type EditableTableDiff<Row> = {
  addedRows: Row[];
  updatedRows: Array<{ rowId: string; changes: Partial<Row> }>;
  deletedRowIds: string[];
};
```

### 2. TanStack composition boundary

The table passes the scoped edit store through `table.options.meta.editing`.
Editable cell renderers opt in by using that metadata; ordinary TanStack cell
renderers remain read-only and need no knowledge of edit mode. This follows
TanStack's editable-data pattern while avoiding its whole-array `setData(map)`
update cost.

Column composition remains explicit:

- ID: read-only for a persisted example. A new example instead offers an
  optional custom ID; leaving it blank lets the server generate one.
- Splits: normal read-only cell.
- Input/output/metadata: `EditableJSONCell`.
- Remove/restore: edit-mode-only row action.

Future text, number, enum, and date editors should use the same cell-state hook
and commit parsed domain values to the store.

References:

- [TanStack editable-data example](https://github.com/TanStack/table/tree/main/examples/react/editable-data)
- [TanStack Table instance and metadata model](https://tanstack.com/table/v8/docs/guide/tables)
- [TanStack Table virtualization guide](https://tanstack.com/table/v8/docs/guide/virtualization)

### 3. JSON cell interaction

Read mode renders the existing compact JSON value. Edit mode turns the value
into a keyboard-focusable edit control and marks changed cells. Activating the
cell opens one modal JSON editor. The editor owns transient text while the user
types; only valid JSON objects are committed to the table store. Cancel closes
the editor without modifying the table diff.

Keeping editor text local has two useful properties:

- Temporarily invalid text does not corrupt the row model.
- CodeMirror is mounted for only the active cell, not every visible JSON cell.

### 4. Virtual rows and lazy server pages

TanStack Virtual renders visible rows plus a small overscan window. Stable row
IDs are mandatory; array indexes are never edit identities. Relay pagination
continues to retain loaded cursor pages, and reaching the end of the virtual
window requests the next page. Local created rows are independent of Relay
pages and remain visible while pages arrive.

The shared edit store has no pagination API. This is intentional: a consumer
may use Relay, TanStack Query, an in-memory array, or a bidirectional data
source. Loading and eviction policies belong to that adapter.

For true arbitrary bidirectional server navigation, add a windowed data-source
adapter with `loadBefore(cursor)` and `loadAfter(cursor)`. It must pin baseline
rows referenced by local patches until the edit session is saved or cancelled.

### 5. Atomic dataset save

The add and delete mutations each create their own version. The dataset examples
editor therefore commits its whole diff through a single GraphQL mutation, named
for the HTTP verb it mirrors:

```graphql
patchDatasetExamples(
  input: {
    datasetId
    additions
    patches
    exampleIdsToDelete
    versionDescription
  }
)
```

The resolver validates all existing example IDs against the target dataset,
creates one `DatasetVersion`, and inserts CREATE, PATCH, and DELETE revisions in
one database transaction. Any validation or database failure rolls back the
whole save.

The save dialog summarizes create/update/delete counts and accepts an optional
version description. Save is disabled for an empty diff or invalid cell. A
mutation failure stays in the dialog as a persistent inline alert. On success,
the dataset's latest version is refreshed, which causes the examples fragment
to refetch against that version, and the local edit session is cleared.

## State transitions

```text
read --Edit--> editing --Save dialog/confirm--> saving
 ^                 |                           |
 |                 +--Cancel------------------+
 |                                             |
 +---------------- success + version refresh--+

saving --failure--> editing (diff is retained)
```

Filters and split selection are disabled during an edit session so the visible
baseline cannot silently change underneath a diff. Row-detail navigation and
the immediate-delete selection toolbar are also disabled while editing.

## Performance invariants

- Cell edits must not rebuild the TanStack `data` array.
- Cell edits must not render unrelated cells.
- Only structural changes (add/delete) rebuild the visible row list.
- Only the active JSON editor mounts CodeMirror.
- Repeated ID and dirty checks use keyed records/sets, not array scans.
- The DOM row count is bounded by viewport size plus overscan, not loaded rows.
- The save payload contains only changed fields and rows.

## Conflict and consistency policy

The first slice scopes every write to `datasetId` and rejects missing, deleted,
or cross-dataset example IDs. It does not yet perform optimistic concurrency
against the version that began the edit session. A later slice should send
`baseVersionId` and have the server reject a stale base with a conflict that
offers users reload or rebase choices.

Until then, the UI freezes filters and its selected dataset version during an
edit session, but another user's concurrent save can still produce
last-write-wins behavior for overlapping examples.

## Testing

- Store unit tests: update/revert, add/delete, delete/update precedence, dirty
  counts, validation, reset, and compact diff generation.
- Mutation tests: mixed change set creates exactly one version; unchanged
  fields carry forward; invalid and cross-dataset IDs roll back all writes.
- Frontend component tests: edit-mode controls, valid/invalid JSON, save summary,
  and mutation error retention.
- Browser verification: keyboard access, focus return, sticky header,
  virtualization during fast scrolling, add/delete responsiveness, dark/light
  themes, and save/refetch behavior.

## Follow-on work

1. Add `baseVersionId` optimistic concurrency and a conflict UI.
2. Add text/number/enum editor primitives and spreadsheet keyboard navigation.
3. Add range selection, copy/paste, and fill operations as batched store actions.
4. Add a bidirectional cursor-window adapter with dirty-row pinning and bounded
   page retention for 100k+ row datasets.
5. Add undo/redo as an operation log layered above the compact diff store.
6. Add split assignment editing as a separate column editor and include it in
   the atomic dataset change mutation.
