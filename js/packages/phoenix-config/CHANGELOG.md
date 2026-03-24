# @arizeai/phoenix-config

## 0.1.3

### Patch Changes

- b4ded15: Update package READMEs with latest capabilities
  - phoenix-client: Add Sessions section documenting `listSessions`, `getSession`, and `addSessionAnnotation`
  - phoenix-evals: Add full pre-built evaluators table (conciseness, correctness, document relevance, refusal, tool evaluators), fix import paths for `bindEvaluator`
  - phoenix-mcp: Expand Tool Coverage section with complete, accurate tool list
  - phoenix-config: Full documentation replacing the one-line placeholder (installation, environment variables, usage examples)
  - phoenix-cli: Add `px annotation-config` command documentation

## 0.1.2

### Patch Changes

- e4bdcf6: Expand phoenix-mcp server coverage with breaking parameter changes

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

## 0.1.1

### Patch Changes

- db24319: fix: polish experiment run output formatting and clarity

## 0.1.0

### Minor Changes

- 0f2950e: centralize phoenix config
