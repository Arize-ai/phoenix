# @arizeai/phoenix-otel

## 2.1.0

### Minor Changes

- dc451a6: Re-export `OTLPTraceExporter` from the package root and add the ESM-only `@arizeai/phoenix-otel/vercel` subpath re-exporting `@arizeai/openinference-vercel` (span processors, `isOpenInferenceSpan`, and types). Custom span-processor setups — e.g. filtering Vercel AI SDK / Eve traces via `register()`'s `spanProcessors` option — can now import everything from `@arizeai/phoenix-otel` without installing the underlying packages.

## 2.0.0

### Major Changes

- 30f0827: Upgrade `@arizeai/openinference-vercel` to v3, which translates AI SDK v7 (`@ai-sdk/otel`) spans to OpenInference. AI SDK telemetry remains explicitly application-configured because its registry is process-global. The package retains its Node.js 18 minimum and ESM/CommonJS entry points: because `@arizeai/openinference-vercel` v3 is ESM-only, the OpenInference span processors are loaded lazily via dynamic import (spans recorded before the load completes are buffered and replayed), and `LazyOpenInferenceSpanProcessor` is exported for custom provider setups. AI SDK v6 spans are no longer translated; stay on 1.x for AI SDK v6.

## 1.2.0

### Minor Changes

- f94067b: Add px setup script for agent onboarding

### Patch Changes

- Updated dependencies [f94067b]
  - @arizeai/phoenix-config@0.4.0

## 1.1.1

### Patch Changes

- c0ab6a9: Add `.env.phoenix` file discovery as a fallback source for Phoenix configuration. When a setting is not present in the process environment, `@arizeai/phoenix-config` walks up from the current working directory to the nearest `.env.phoenix` file and reads `PHOENIX_`-prefixed keys from it (dotenv format). Process environment values take precedence, and related settings (credentials, OTel endpoint/port) are resolved as a group from a single source. Files not owned by the current user are ignored, with one-time warnings for skipped files, for files accessible to other users, and for endpoints paired with credentials from a different source. Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery; call `clearEnvFileCache()` to refresh cached results. Browser builds use a Node-free implementation selected through a conditional package export. `@arizeai/phoenix-cli` ranks discovered values below configured profiles; `@arizeai/phoenix-mcp` and `@arizeai/phoenix-otel` read `.env.phoenix` values through the shared resolution.
- Updated dependencies [c0ab6a9]
  - @arizeai/phoenix-config@0.3.0

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
