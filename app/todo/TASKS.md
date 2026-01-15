# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Type and Interface Updates

### update-playground-types

- content: Update PlaygroundProps and PlaygroundState types in `src/store/playground/types.ts`. Remove `appendedMessagesPathByDataset: Record<string, string | null>` and replace it with `appendedMessagesPath: string | null` (single path per store). This simplifies the type since each store will now be dataset-specific.
- status: complete
- dependencies: none

### add-dataset-id-to-store-factory

- content: Update `createPlaygroundStore` in `src/store/playground/playgroundStore.tsx` to accept an optional `datasetId?: string` parameter. This ID will be used to generate a dataset-specific storage key for the persist middleware.
- status: complete
- dependencies: update-playground-types

---

## Phase 2: Dynamic Store Name Implementation

### implement-dynamic-storage-key

- content: Modify the `persist` middleware configuration in `createPlaygroundStore` to use a dynamic storage key based on datasetId. When datasetId is provided, use `arize-phoenix-playground-dataset-{datasetId}`. When datasetId is undefined/null, use the default `arize-phoenix-playground`. Update the `partialize` function to persist the renamed `appendedMessagesPath` field instead of `appendedMessagesPathByDataset`.
- status: complete
- dependencies: add-dataset-id-to-store-factory

---

## Phase 3: Context and Provider Updates

### update-playground-provider

- content: Update `PlaygroundProvider` in `src/contexts/PlaygroundContext.tsx` to accept an optional `datasetId` prop and pass it to `createPlaygroundStore`. The provider should recreate the store when the datasetId changes (use datasetId as part of the key).
- status: complete
- dependencies: implement-dynamic-storage-key

### integrate-dataset-id-from-url

- content: Update `Playground.tsx` to extract `datasetId` from URL search params and pass it to `PlaygroundProvider`. This ensures the correct store is created/loaded based on the current dataset selection.
- status: complete
- dependencies: update-playground-provider

---

## Phase 4: Update Consumers

### update-appended-messages-path-consumers

- content: Update all components that use `appendedMessagesPathByDataset` to use the new `appendedMessagesPath` field. This includes `PlaygroundExperimentSettingsButton.tsx`, `playgroundUtils.ts`, and any other files that reference this field. The datasetId lookup is no longer needed since the store is already dataset-specific.
- status: complete
- dependencies: integrate-dataset-id-from-url

### update-set-appended-messages-path-action

- content: Update the `setAppendedMessagesPath` action in `playgroundStore.tsx` to set a single path value instead of updating a record keyed by datasetId. Update the function signature from `(datasetId: string, path: string | null)` to just `(path: string | null)`.
- status: complete
- dependencies: update-appended-messages-path-consumers

---

## Phase 5: Testing and Cleanup

### add-store-persistence-tests

- content: Add unit tests to verify that: (1) stores with different datasetIds use different localStorage keys, (2) the default store uses `arize-phoenix-playground`, (3) dataset-specific stores use `arize-phoenix-playground-dataset-{id}`, (4) state is correctly persisted and restored per dataset.
- status: pending
- dependencies: update-set-appended-messages-path-action

### verify-existing-tests-pass

- content: Run the full test suite (`pnpm test`) and fix any broken tests related to playground store changes. Ensure TypeScript compilation passes (`pnpm typecheck`).
- status: pending
- dependencies: add-store-persistence-tests
