---
"@arizeai/phoenix-mcp": major
"@arizeai/phoenix-config": patch
---

Expand phoenix-mcp server coverage with breaking parameter changes

### Breaking changes

- Tool parameters renamed to snake_case (`datasetIdentifier` → `dataset_id`/`dataset_name`, `experiment_id` replaces `experiment_id`, `prompt_identifier`, `project_identifier`, etc.)
- `resolveTraceIdByPrefix` removed — `get-trace` now requires an exact trace ID
- Legacy identifier fallback patterns removed (`requirePreferredIdentifier`, `legacyProjectIdentifier`)

### New tools

- `list-projects`, `get-project`, `list-traces`, `get-trace`, `get-spans`, `get-span-annotations`
- `list-sessions`, `get-session`, `list-annotation-configs`, `phoenix-support`
- `get-prompt-version-by-tag`, `list-prompt-version-tags`, `add-prompt-version-tag`

### Improvements

- Generic `fetchAllPages` pagination helper replaces duplicated cursor loops
- Centralized constants, deduplicated `extractSpanIds`, cached RunLLM client
- `ENV_PHOENIX_PROJECT` moved to `@arizeai/phoenix-config` for reuse
