# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## update-playground-types

- The type change from `appendedMessagesPathByDataset: Record<string, string | null>` to `appendedMessagesPath: string | null` is in `PlaygroundProps` interface at `src/store/playground/types.ts:259-265`
- `PlaygroundState` extends `PlaygroundProps` (via `Omit<PlaygroundProps, "instances">`), so the type change automatically propagates to `PlaygroundState`
- There's also a `setAppendedMessagesPath` function signature in `PlaygroundState` (line 451) that takes `(datasetId: string, path: string | null)` - this will need updating in a later task (`update-set-appended-messages-path-action`)
- Expected TypeScript errors will appear in consumers (`playgroundStore.tsx`, `PlaygroundExperimentSettingsButton.tsx`, `playgroundUtils.ts`, `PlaygroundChatTemplate.tsx`) - these are intentional and will be fixed by subsequent tasks
- Unit tests all pass (477 tests) since no existing tests directly test the type shape - the tests use the store implementation which hasn't been updated yet

## add-dataset-id-to-store-factory

- The `createPlaygroundStore` function in `src/store/playground/playgroundStore.tsx` now accepts an optional second parameter `datasetId?: string`
- Since the parameter is optional with no default usage yet, all existing call sites continue to work without modification
- The LSP errors visible in `playgroundStore.tsx` are pre-existing from the prior type update task (`update-playground-types`) - these are about `appendedMessagesPath` vs `appendedMessagesPathByDataset` mismatches that will be resolved in the `implement-dynamic-storage-key` task
- The next task (`implement-dynamic-storage-key`) will use this `datasetId` parameter to generate dataset-specific storage keys in the persist middleware

## implement-dynamic-storage-key

- Updated `persist` middleware to use dynamic storage key: `arize-phoenix-playground-dataset-{datasetId}` when datasetId is provided, otherwise `arize-phoenix-playground`
- Changed initial state from `appendedMessagesPathByDataset: {}` to `appendedMessagesPath: null` in `playgroundStore.tsx:271`
- Updated `setAppendedMessagesPath` action signature from `(datasetId: string, path: string | null)` to `(path: string | null)` - simplified since store is now dataset-specific
- Updated `partialize` function to persist `appendedMessagesPath` instead of `appendedMessagesPathByDataset`
- Also updated the type signature in `types.ts:451` for `setAppendedMessagesPath`
- TypeScript errors remain in consumer files (`PlaygroundChatTemplate.tsx`, `PlaygroundExperimentSettingsButton.tsx`, `playgroundUtils.ts`) - these are expected and will be fixed by the `update-appended-messages-path-consumers` task
- Tests pass (477 tests) - Vitest uses Babel/esbuild transpilation which ignores TypeScript errors

## update-playground-provider

- Added `datasetId?: string` prop to `PlaygroundProvider` in `src/contexts/PlaygroundContext.tsx`
- Used `useMemo` with `datasetId` as dependency to recreate the store when datasetId changes
- The `props` object is intentionally NOT in the dependency array - only `datasetId` triggers store recreation
- Added eslint-disable comments for `react-hooks/exhaustive-deps` and `react-compiler/react-compiler` since we intentionally only want to recreate on datasetId change
- Created a new `PlaygroundProviderProps` type that extends `InitialPlaygroundState` with the optional `datasetId` prop
- The `datasetIdRef` is used to track changes but isn't strictly necessary since `useMemo` handles the recreation
- TypeScript errors still exist in consumer files from previous tasks - these are expected until `update-appended-messages-path-consumers` is completed
- Tests pass (477 tests) and the implementation is ready for the next task (`integrate-dataset-id-from-url`)
