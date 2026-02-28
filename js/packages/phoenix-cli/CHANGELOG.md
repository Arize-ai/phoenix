# @arizeai/phoenix-cli

## 0.7.0

### Minor Changes

- bd85bce: Add `px sessions` and `px session` commands for browsing multi-turn conversation sessions via the REST API.

### Patch Changes

- Updated dependencies [c3c700a]
  - @arizeai/phoenix-client@6.0.0

## 0.6.0

### Minor Changes

- 67e8111: Add `px api graphql` command for executing raw GraphQL queries against the Phoenix API. Only queries are permitted — mutations and subscriptions are rejected. Output is pretty-printed JSON, suitable for piping to `jq`.

### Patch Changes

- Updated dependencies [db24319]
- Updated dependencies [b18325b]
  - @arizeai/phoenix-client@5.9.0
  - @arizeai/phoenix-config@0.1.1

## 0.5.2

### Patch Changes

- Updated dependencies [8be1940]
  - @arizeai/phoenix-client@5.8.2

## 0.5.1

### Patch Changes

- @arizeai/phoenix-client@5.8.1

## 0.5.0

### Minor Changes

- 27f5470: px auth status command added

## 0.4.0

### Minor Changes

- af4dc46: Add prompt introspection commands to Phoenix CLI
  - `px prompts`: List all available prompts with names and descriptions
  - `px prompt <identifier>`: Show a specific prompt with support for `--tag` and `--version` options
  - `--format text`: Output prompt content with XML-style role tags for piping to AI assistants like Claude Code
  - Pretty print now includes full tool definitions with parameters, types, and descriptions
  - Added `listPrompts` function to phoenix-client

### Patch Changes

- Updated dependencies [af4dc46]
  - @arizeai/phoenix-client@5.8.0

## 0.3.1

### Patch Changes

- Updated dependencies [01eb1fb]
  - @arizeai/phoenix-client@5.7.0

## 0.3.0

### Minor Changes

- c71dc1d: add annotation argument to the CLI

## 0.2.0

### Minor Changes

- 32343ff: Add datasets and experiments commands to the CLI:
  - `px datasets` - List all available Phoenix datasets with example counts and metadata
  - `px dataset <name-or-id>` - Fetch examples from a dataset with optional `--split` and `--version` filters
  - `px experiments --dataset <name-or-id>` - List experiments for a dataset, optionally export full experiment data to a directory
  - `px experiment <experiment-id>` - Fetch a single experiment with all run data, evaluations, and trace IDs

  All commands support `--format pretty|json|raw` output modes for both human readability and machine consumption.

## 0.1.0

### Minor Changes

- d69eb80: initial trace dump api

## 0.0.4

### Patch Changes

- 4208604: trigger changeset publish

## 0.0.3

### Patch Changes

- c96475c: trigger changeset publish

## 0.0.2

### Patch Changes

- 857b617: add links to packages

## 0.0.1

### Patch Changes

- 30242a6: initial cli
