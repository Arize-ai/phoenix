# @arizeai/phoenix-cli

## 1.0.0

### Major Changes

- 4b5dd70: Refactor the Phoenix CLI resource commands to a noun-verb format.

  This is a breaking change for CLI consumers. Flat commands like `px projects`,
  `px traces`, `px spans`, `px datasets`, `px sessions`, `px experiments`, and
  `px prompts` have been replaced with singular resource commands and verb
  subcommands such as `px project list`, `px trace list`, `px trace get`,
  `px span list`, `px dataset list`, `px dataset get`, `px session list`,
  `px session get`, `px experiment list`, `px experiment get`, `px prompt list`,
  and `px prompt get`.

  Help text and documentation were updated to reflect the new command structure.

## 0.12.1

### Patch Changes

- b4ded15: Update package READMEs with latest capabilities
  - phoenix-client: Add Sessions section documenting `listSessions`, `getSession`, and `addSessionAnnotation`
  - phoenix-evals: Add full pre-built evaluators table (conciseness, correctness, document relevance, refusal, tool evaluators), fix import paths for `bindEvaluator`
  - phoenix-mcp: Expand Tool Coverage section with complete, accurate tool list
  - phoenix-config: Full documentation replacing the one-line placeholder (installation, environment variables, usage examples)
  - phoenix-cli: Add `px annotation-config` command documentation

- Updated dependencies [b4ded15]
  - @arizeai/phoenix-client@6.5.4
  - @arizeai/phoenix-config@0.1.3

## 0.12.0

### Minor Changes

- 4444b46: Add `px self update` so the Phoenix CLI can check for a newer published version
  and upgrade itself in place.

  The command now:
  - shows the current and latest published CLI versions
  - supports `--check` for status-only checks
  - updates global installs managed by `npm`, `pnpm`, and `bun`
  - updates standard `deno install -g` wrapper installs by replaying the wrapper's install flags

### Patch Changes

- Updated dependencies [e4bdcf6]
  - @arizeai/phoenix-config@0.1.2
  - @arizeai/phoenix-client@6.5.3

## 0.11.1

### Patch Changes

- 71d2b1b: Improve the Phoenix CLI startup experience with a clearer banner and help output.
  - Show a cleaner banner description and version label.
  - Only display update guidance when a newer CLI version is actually available.
  - Normalize prompt help text to use `prompt-identifier`.

## 0.11.0

### Minor Changes

- 3bccd12: Add `--curl` support to `px api graphql` so users can print the equivalent
  request without executing it. Authorization headers are masked by default, and
  `--show-token` can be used to reveal the raw token when explicitly needed.

## 0.10.1

### Patch Changes

- d204898: docs: document recently added commands and methods in package READMEs
- Updated dependencies [d204898]
  - @arizeai/phoenix-client@6.5.2

## 0.10.0

### Minor Changes

- 65e52c2: Add `px spans` command for fetching spans with filters.
  Uses table format for pretty output, consistent with other CLI commands like `px projects` and `px datasets`.

## 0.9.2

### Patch Changes

- Updated dependencies [91949d7]
  - @arizeai/phoenix-client@6.5.1

## 0.9.1

### Patch Changes

- d320b93: Migrate llms.txt parser to standard llmstxt.org markdown link format (`- [Title](url): Description`)

## 0.9.0

### Minor Changes

- c0836c3: Add `px docs fetch` command to download Phoenix documentation markdown for coding agents.
  Fetches from the llms.txt index with workflow filtering, concurrent downloads, and auto-generated index files.

## 0.8.0

### Minor Changes

- 62666f6: Add `px annotation-config list` command to list all annotation configurations.

  The new command fetches annotation configs from `GET /v1/annotation_configs` with cursor-based pagination and supports `--format pretty|json|raw`, `--limit`, `--endpoint`, `--api-key`, and `--no-progress` options.

- d647a32: Add ASCII art banner to CLI intro displayed when running `px` with no arguments.
  Shows the connected server URL and project name alongside the Phoenix logo.
- a6319de: Replace verbose box-drawing list output with compact ASCII tables for all `list` commands.

  Commands like `px datasets list`, `px experiments list`, `px prompts list`, `px sessions list`,
  `px projects list`, and `px annotation-config list` now render results as aligned tabular output
  (matching the style of `console.table`) instead of multi-line box-drawing cards. This makes long
  lists far easier to scan at a glance. The `--format json` and `--format raw` output is unchanged.

- 4e7b7c2: Add semantic exit codes to the CLI for scripting and CI integration.

  Commands now exit with meaningful codes instead of always using `1` on failure:

  | Code | Meaning          | Description                                            |
  | ---- | ---------------- | ------------------------------------------------------ |
  | `0`  | Success          | Command completed successfully                         |
  | `1`  | Failure          | Unspecified or unexpected error                        |
  | `2`  | Cancelled        | User cancelled the operation                           |
  | `3`  | Invalid argument | Bad CLI flags, missing required args, or invalid input |
  | `4`  | Auth required    | Not authenticated or insufficient permissions          |
  | `5`  | Network error    | Failed to connect to server or network request failed  |

### Patch Changes

- Updated dependencies [9769f90]
  - @arizeai/phoenix-client@6.5.0

## 0.7.4

### Patch Changes

- Updated dependencies [83b7f68]
  - @arizeai/phoenix-client@6.4.0

## 0.7.3

### Patch Changes

- Updated dependencies [d951320]
  - @arizeai/phoenix-client@6.3.0

## 0.7.2

### Patch Changes

- Updated dependencies [6d896e3]
  - @arizeai/phoenix-client@6.2.0

## 0.7.1

### Patch Changes

- Updated dependencies [b8ba989]
- Updated dependencies [6296d0a]
- Updated dependencies [6296d0a]
  - @arizeai/phoenix-client@6.1.0

## 0.7.0

### Minor Changes

- 03b10a8: Add `px sessions` and `px session` commands for browsing multi-turn conversation sessions via the REST API.

### Patch Changes

- Updated dependencies [03b10a8]
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
