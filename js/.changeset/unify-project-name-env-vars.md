---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-otel": minor
"@arizeai/phoenix-cli": minor
"@arizeai/phoenix-mcp": minor
---

Unify the project-name environment variable across the TypeScript packages: every surface now reads both `PHOENIX_PROJECT_NAME` (canonical) and `PHOENIX_PROJECT` (supported alias), with `PHOENIX_PROJECT_NAME` taking precedence and explicit args/flags still winning over both. When both are set to conflicting values, the canonical value is used and a one-time warning naming both values is emitted. `@arizeai/phoenix-config` is the single home for this resolution: it exposes the shared `getProjectFromEnvironment()` resolver and includes the resolved project in `getEnvironmentConfig()`. `@arizeai/phoenix-cli`, `@arizeai/phoenix-mcp`, and `@arizeai/phoenix-otel` all consume it — `@arizeai/phoenix-otel` now depends on `@arizeai/phoenix-config` and its `register()` falls back to these variables (via the shared resolver) when no `projectName` is passed, rather than duplicating the logic.
