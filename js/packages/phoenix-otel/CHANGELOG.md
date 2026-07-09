# @arizeai/phoenix-otel

## 1.1.0

### Minor Changes

- 1e7d9fc: Unify the project-name environment variable across the TypeScript packages: every surface now reads both `PHOENIX_PROJECT` (canonical) and `PHOENIX_PROJECT_NAME` (supported alias), with `PHOENIX_PROJECT` taking precedence and explicit args/flags still winning over both. When both are set to conflicting values, the canonical value is used and a one-time warning naming both values is emitted. `@arizeai/phoenix-config` is the single home for this resolution: it exposes the shared `getProjectFromEnvironment()` resolver and includes the resolved project in `getEnvironmentConfig()`. `@arizeai/phoenix-cli`, `@arizeai/phoenix-mcp`, and `@arizeai/phoenix-otel` all consume it — `@arizeai/phoenix-otel` now depends on `@arizeai/phoenix-config` and its `register()` falls back to these variables (via the shared resolver) when no `projectName` is passed, rather than duplicating the logic.

### Patch Changes

- Updated dependencies [1e7d9fc]
  - @arizeai/phoenix-config@0.2.0

## 1.0.2

### Patch Changes

- 559acf8: Document `hideLLMTools` / `OPENINFERENCE_HIDE_LLM_TOOLS` trace config option in README

## 1.0.1

### Patch Changes

- 5d14f23: Add LinkedIn link to the Community section of the README.

## 1.0.0

### Major Changes

- 1449f3d: Re-export openinference semantic conventions from phoenix-otel and update phoenix-client to import them from phoenix-otel instead of depending on @arizeai/openinference-semantic-conventions directly.

## 0.4.3

### Patch Changes

- 1028be5: Bundle curated package docs and examples into npm packages under `docs/`.

## 0.4.2

### Patch Changes

- 03b10a8: Align OpenTelemetry dependencies in `@arizeai/phoenix-otel` to a compatible v2 set.

## 0.4.1

### Patch Changes

- 7456462: Re-export `DiagLogLevel` as a runtime value so consumers can import it directly from `@arizeai/phoenix-otel`.

## 0.4.0

### Minor Changes

- a8896db: feat: Enhance compatibility with ai-sdk v6 telemetry

## 0.3.4

### Patch Changes

- 4208604: trigger changeset publish

## 0.3.3

### Patch Changes

- c96475c: trigger changeset publish

## 0.3.2

### Patch Changes

- 857b617: add links to packages

## 0.3.1

### Patch Changes

- ce5febf: normalize urls with no trailing slashes

## 0.3.0

### Minor Changes

- 419ea76: feat: Upgrade @arizeai/openinference-vercel for improved ai sdk support

## 0.2.1

### Patch Changes

- 8bbff3a: readme examples

## 0.2.0

### Minor Changes

- de6f111: refactor to use phoenix-otel across the client

## 0.1.0

### Minor Changes

- 08c7419: add support for passing instrumentation to register"

## 0.0.1

### Patch Changes

- c9a35c3: initial release of phoenix-otel
