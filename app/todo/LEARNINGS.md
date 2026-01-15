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
