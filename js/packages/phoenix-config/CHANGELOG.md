# @arizeai/phoenix-config

## 0.5.0

### Minor Changes

- d04f0fc: Introduce `PHOENIX_ENDPOINT` as the canonical base URL for API access, alongside `PHOENIX_COLLECTOR_ENDPOINT` for trace export.

  Previously the TypeScript client read only `PHOENIX_HOST`, so pointing `PHOENIX_COLLECTOR_ENDPOINT` at a remote Phoenix and then reading spans back silently targeted `http://localhost:6006`. The client's base URL now resolves `PHOENIX_ENDPOINT` first, then the trace-export variables `PHOENIX_COLLECTOR_ENDPOINT` and `OTEL_EXPORTER_OTLP_ENDPOINT` (any `/v1/traces` path is stripped), then the legacy `PHOENIX_HOST` — matching the Python client rung for rung, so the same environment reaches the same server from either language.

  `PHOENIX_BASE_URL` is honored below the trace-export variables as an undocumented compatibility fallback. The client docs advertised that name for years while no code read it, so values set from those docs did nothing; placing it below the other variables means those configurations start working without retargeting anyone who set both. It is also no longer enough on its own to displace a discovered `.env.phoenix`, so a stale value left in a shell cannot redirect a project that `px setup` configured.

  Empty and whitespace-only values now count as unset everywhere in the resolution chains, so `export PHOENIX_ENDPOINT=` falls through to the next variable instead of stranding every consumer on localhost.

  Experiment and test-suite tracing follow the same rules as `register()`: a client created with an explicit `baseUrl` exports its spans to that server, and a client whose base URL came from the environment lets the trace-export variables decide. An unparseable endpoint in a discovered `.env.phoenix` now falls back with a warning instead of aborting the run, and the cross-tier credential warning fires on this path too.

  `@arizeai/phoenix-config` gains `ENV_PHOENIX_ENDPOINT`, `ENV_OTEL_EXPORTER_OTLP_ENDPOINT`, `ENV_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `getBaseUrlFromEnvironment[WithSource]()`, `getBaseUrlFromValues()` (same precedence over an injected env record), `getTraceExportEndpointFromEnvironment()`, and `PHOENIX_CONNECTION_ENV_KEYS` (for test env hygiene).

## 0.4.0

### Minor Changes

- f94067b: Add px setup script for agent onboarding

## 0.3.0

### Minor Changes

- c0ab6a9: Add `.env.phoenix` file discovery as a fallback source for Phoenix configuration. When a setting is not present in the process environment, `@arizeai/phoenix-config` walks up from the current working directory to the nearest `.env.phoenix` file and reads `PHOENIX_`-prefixed keys from it (dotenv format). Process environment values take precedence, and related settings (credentials, OTel endpoint/port) are resolved as a group from a single source. Files not owned by the current user are ignored, with one-time warnings for skipped files, for files accessible to other users, and for endpoints paired with credentials from a different source. Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery; call `clearEnvFileCache()` to refresh cached results. Browser builds use a Node-free implementation selected through a conditional package export. `@arizeai/phoenix-cli` ranks discovered values below configured profiles; `@arizeai/phoenix-mcp` and `@arizeai/phoenix-otel` read `.env.phoenix` values through the shared resolution.

## 0.2.0

### Minor Changes

- 1e7d9fc: Unify the project-name environment variable across the TypeScript packages: every surface now reads both `PHOENIX_PROJECT` (canonical) and `PHOENIX_PROJECT_NAME` (supported alias), with `PHOENIX_PROJECT` taking precedence and explicit args/flags still winning over both. When both are set to conflicting values, the canonical value is used and a one-time warning naming both values is emitted. `@arizeai/phoenix-config` is the single home for this resolution: it exposes the shared `getProjectFromEnvironment()` resolver and includes the resolved project in `getEnvironmentConfig()`. `@arizeai/phoenix-cli`, `@arizeai/phoenix-mcp`, and `@arizeai/phoenix-otel` all consume it — `@arizeai/phoenix-otel` now depends on `@arizeai/phoenix-config` and its `register()` falls back to these variables (via the shared resolver) when no `projectName` is passed, rather than duplicating the logic.

## 0.1.4

### Patch Changes

- 5d14f23: Add LinkedIn link to the Community section of the README.

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
