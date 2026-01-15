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

## locate-tag-version-ui

- Tagging UI lives in `app/src/pages/prompt/PromptVersionDetailsPage.tsx:68` via `TagPromptVersionButton`.
- `TagPromptVersionButton` relies on `useParams()` for `promptId` and `versionId`, so the route must provide both.
- Tag list data needs `promptId` + `versionId` for `TagPromptVersionButtonTagsQuery` (prompt `versionTags` + promptVersion `tags`).
- New tag dialog uses `NewPromptVersionDialog` with `promptVersionId`, `onDismiss`, and `onNewTagCreated` callbacks.
- Tag set mutation needs `promptId` plus `SetPromptVersionTagInput` (`name`, `promptVersionId`, optional `description`).

## add-tagging-entrypoint

- Added `TagPromptVersionButton` to the playground template toolbar behind route-param checks.
- Guarding on `useParams` avoids throwing when `/playground` lacks `promptId`/`versionId`.
- Tag entrypoint only renders on version-specific playground routes until data wiring is added.

## wire-tag-modal-playground

- `TagPromptVersionButton` now accepts explicit `promptId`/`versionId` props with route fallbacks.
- Playground wiring should pass instance `promptId`/`promptVersionId` to avoid relying on URL params.
- Tagging works with tagged prompts because the instance always stores the resolved version id.

## verify-playground-tagging

- Manual verification should cover opening `/playground`, using the tag button, creating a tag, and confirming it appears in the tag dropdown.
- The flow depends on having a prompt instance with `promptId` + `promptVersionId` available in the playground state.
- Skip automated tests for this task; keep verification steps documented for future reference.
