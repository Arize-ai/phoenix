# @arizeai/phoenix-cli

## 1.11.1

### Patch Changes

- e35712a: Re-release to recover from a failed publish (versions were already on npm)
- Updated dependencies [e35712a]
  - @arizeai/phoenix-client@7.1.1

## 1.11.0

### Minor Changes

- df7057a: Add `--span-id` filter to `px span list`, allowing spans to be fetched by OpenTelemetry span ID (requires Phoenix server >= 19.6.0). Add `--until` to bound `px span list` and `px trace list` by an exclusive end timestamp, pairing with `--since` for time ranges.

### Patch Changes

- Updated dependencies [df7057a]
  - @arizeai/phoenix-client@7.1.0

## 1.10.5

### Patch Changes

- Updated dependencies [a6c3f88]
  - @arizeai/phoenix-client@7.0.1

## 1.10.4

### Patch Changes

- 4867e34: Update the `ai` dependency to v7 to match `@arizeai/phoenix-client`'s `ai@^7.0.0` peer requirement, so installing the CLI no longer produces an unresolvable peer conflict. The CLI only uses the AI SDK's UI-message transport APIs, which are unchanged in v7.
- Updated dependencies [4867e34]
  - @arizeai/phoenix-client@7.0.0

## 1.10.3

### Patch Changes

- @arizeai/phoenix-client@6.14.2

## 1.10.2

### Patch Changes

- @arizeai/phoenix-client@6.14.1

## 1.10.1

### Patch Changes

- 1f3c4b6: `px auth login` now probes the server's `.well-known/oauth-authorization-server` discovery document before starting the browser flow, bailing out cleanly with a network error when the server is unreachable and an auth error when the server does not support OAuth login

## 1.10.0

### Minor Changes

- 3abafcf: Add `px setup mcp` to register the Phoenix remote MCP server with a coding agent (Claude Code, Cursor, Codex, and others), with OAuth by default, `--header` for API-key auth, and local/global scopes

## 1.9.1

### Patch Changes

- d6b1cbb: Add a reusable refreshable-credential fetch wrapper to the Phoenix TypeScript
  client, use it for OAuth-authenticated CLI API and PXI requests, and keep each
  profile bound to the endpoint that issued its OAuth tokens.
- Updated dependencies [d6b1cbb]
  - @arizeai/phoenix-client@6.14.0

## 1.9.0

### Minor Changes

- f94067b: Add px setup script for agent onboarding

### Patch Changes

- Updated dependencies [f94067b]
  - @arizeai/phoenix-client@6.13.0
  - @arizeai/phoenix-config@0.4.0

## 1.8.1

### Patch Changes

- c0ab6a9: Add `.env.phoenix` file discovery as a fallback source for Phoenix configuration. When a setting is not present in the process environment, `@arizeai/phoenix-config` walks up from the current working directory to the nearest `.env.phoenix` file and reads `PHOENIX_`-prefixed keys from it (dotenv format). Process environment values take precedence, and related settings (credentials, OTel endpoint/port) are resolved as a group from a single source. Files not owned by the current user are ignored, with one-time warnings for skipped files, for files accessible to other users, and for endpoints paired with credentials from a different source. Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery; call `clearEnvFileCache()` to refresh cached results. Browser builds use a Node-free implementation selected through a conditional package export. `@arizeai/phoenix-cli` ranks discovered values below configured profiles; `@arizeai/phoenix-mcp` and `@arizeai/phoenix-otel` read `.env.phoenix` values through the shared resolution.
- Updated dependencies [c0ab6a9]
  - @arizeai/phoenix-config@0.3.0
  - @arizeai/phoenix-client@6.12.2

## 1.8.0

### Minor Changes

- 1e7d9fc: Unify the project-name environment variable across the TypeScript packages: every surface now reads both `PHOENIX_PROJECT` (canonical) and `PHOENIX_PROJECT_NAME` (supported alias), with `PHOENIX_PROJECT` taking precedence and explicit args/flags still winning over both. When both are set to conflicting values, the canonical value is used and a one-time warning naming both values is emitted. `@arizeai/phoenix-config` is the single home for this resolution: it exposes the shared `getProjectFromEnvironment()` resolver and includes the resolved project in `getEnvironmentConfig()`. `@arizeai/phoenix-cli`, `@arizeai/phoenix-mcp`, and `@arizeai/phoenix-otel` all consume it — `@arizeai/phoenix-otel` now depends on `@arizeai/phoenix-config` and its `register()` falls back to these variables (via the shared resolver) when no `projectName` is passed, rather than duplicating the logic.

### Patch Changes

- Updated dependencies [1e7d9fc]
  - @arizeai/phoenix-config@0.2.0
  - @arizeai/phoenix-client@6.12.1

## 1.7.0

### Minor Changes

- d4282c5: Improve PXI tool call rendering in the terminal: each tool call now shows a state glyph (spinner while running, then ✓/✗/?/⊘), a per-tool icon, and a one-line summary of what the tool is doing, derived from its input. Bash calls display the model-written summary, an excerpt of the executing command, and on failure the exit code plus a stderr excerpt; `load_skill` and `read_skill_resource` collapse to quiet one-liners once complete.

## 1.6.2

### Patch Changes

- Updated dependencies [7947440]
  - @arizeai/phoenix-client@6.12.0

## 1.6.1

### Patch Changes

- 6240c13: fix(cli): improve pxi preflight network errors
- f3809ed: **PXI:** Add slash command support to the `pxi` terminal client. Type `/clear` to reset the conversation history, `/exit` to quit, or `/help` to list available commands. The input prompt now syntax-highlights command tokens in yellow and shows a live completion list while you type.
- Updated dependencies [7afa183]
  - @arizeai/phoenix-client@6.11.2

## 1.6.0

### Minor Changes

- 70246e9: **Beta:** Add the `pxi` terminal client to `@arizeai/phoenix-cli`. Launch an interactive PXI (Phoenix Intelligence) chat from your shell with `npx -y @arizeai/phoenix-cli pxi` (or the `pxi` binary). It connects to a running Phoenix instance's server-agent endpoint — the same agent that powers the in-browser experience — and runs a model preflight on launch so configuration problems surface as a clean error. Configure the endpoint via `PHOENIX_HOST`/`--endpoint` and select a model with `--provider`/`--model` (defaults to Anthropic `claude-opus-4-8`).

  This feature is in beta and may change in a future release.

## 1.5.3

### Patch Changes

- Updated dependencies [a027ada]
  - @arizeai/phoenix-client@6.11.1

## 1.5.2

### Patch Changes

- Updated dependencies [7efabf6]
  - @arizeai/phoenix-client@6.11.0

## 1.5.1

### Patch Changes

- Updated dependencies [0347f22]
  - @arizeai/phoenix-client@6.10.1

## 1.5.0

### Minor Changes

- 6dceb10: Restructure annotation bulk-delete commands into entity-first compound nouns:
  `px span delete-annotations` becomes `px span-annotations delete`,
  `px trace delete-annotations` becomes `px trace-annotations delete`, and
  `px session delete-annotations` becomes `px session-annotations delete`. Flag
  set, authorization gate (`--all` XOR `[--start-time, --end-time)`), payload
  shape, and exit codes are unchanged.

  Add an optional `identifier` body field to `addTraceNote`, `addSpanNote`, and
  `addSessionNote` (and the generated REST types). When non-empty, the note is
  upserted on `(entity_id, name='note', identifier)` so repeated calls with the
  same identifier overwrite the existing note instead of appending. When the
  helper is given an `identifier`, it now also calls
  `ensureServerCapability` against the new identifier body-parameter
  requirement so the caller fails fast against older Phoenix servers (which
  would otherwise silently drop the field and append an auto-generated note).

### Patch Changes

- Updated dependencies [6dceb10]
  - @arizeai/phoenix-client@6.10.0

## 1.4.3

### Patch Changes

- @arizeai/phoenix-client@6.9.3

## 1.4.2

### Patch Changes

- Updated dependencies [d0cc4c4]
  - @arizeai/phoenix-client@6.9.2

## 1.4.1

### Patch Changes

- 5d14f23: Add LinkedIn link to the Community section of the README.
- Updated dependencies [5d14f23]
  - @arizeai/phoenix-config@0.1.4
  - @arizeai/phoenix-client@6.9.1

## 1.4.0

### Minor Changes

- ab62d3d: Add named profiles to the Phoenix CLI: `px profile list|show|create|edit|use|delete`. Profiles persist to `~/.px/settings.json` (or `$XDG_CONFIG_HOME/px/settings.json`, mode `0600`) and feed into config resolution as a new tier between built-in defaults and environment variables. `px auth status` displays the active profile and accepts `--profile <name>` to scope the call. Other commands honour the stored active profile.

  The settings file is JSON-Schema validated; the schema is committed to `schemas/phoenix-cli-settings.json` and can be referenced via the `$schema` field on `settings.json` for editor autocomplete.

### Patch Changes

- 4e20267: Add session annotation and note commands to the Phoenix CLI, and add a session note helper to the TypeScript client. Session note creation requires Phoenix server 14.17.0 or newer.
- Updated dependencies [2993b04]
- Updated dependencies [4e20267]
- Updated dependencies [2993b04]
  - @arizeai/phoenix-client@6.9.0

## 1.3.1

### Patch Changes

- Updated dependencies [e381885]
- Updated dependencies [187df7e]
  - @arizeai/phoenix-client@6.8.1

## 1.3.0

### Minor Changes

- a4dad8b: Add trace note support to `px`. New `px trace add-note <trace-id> --text <text>` command creates a trace note, and `--include-notes` is now supported on `px trace get` and `px trace list` to fetch and render trace notes and span notes separately from annotations. Requires Phoenix server >= 14.13.0.

### Patch Changes

- Updated dependencies [a4dad8b]
  - @arizeai/phoenix-client@6.8.0

## 1.2.0

### Minor Changes

- e19a038: Add `--attribute` filter to `px span list` for filtering by attribute key/value pairs (e.g., `--attribute "llm.model_name:gpt-4"`). Split is on the first `:` only, so values may contain colons. Repeat the flag to AND multiple filters. JSON-quote a value to force string matching when it looks like a number or boolean (e.g., `'user.id:"12345"'`). Requires Phoenix server >= 14.9.0.

### Patch Changes

- Updated dependencies [e19a038]
  - @arizeai/phoenix-client@6.7.0

## 1.1.0

### Minor Changes

- 7944fe7: Add span note support to `px`. New `px span add-note <span-id>` command creates notes on spans, and `--include-notes` is now supported on `px span list`, `px trace get`, and `px trace list` to fetch and render notes alongside spans.

## 1.0.5

### Patch Changes

- Updated dependencies [8444575]
  - @arizeai/phoenix-client@6.6.2

## 1.0.4

### Patch Changes

- Updated dependencies [1449f3d]
  - @arizeai/phoenix-client@6.6.1

## 1.0.3

### Patch Changes

- Updated dependencies [c70eca6]
  - @arizeai/phoenix-client@6.6.0

## 1.0.2

### Patch Changes

- Updated dependencies [1028be5]
  - @arizeai/phoenix-client@6.5.5

## 1.0.1

### Patch Changes

- f8d5871: Use explicit radix in parseInt for Commander.js option parsers

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
