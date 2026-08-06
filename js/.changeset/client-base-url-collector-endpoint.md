---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-client": minor
---

Introduce `PHOENIX_ENDPOINT` as the canonical base URL for API access, alongside `PHOENIX_COLLECTOR_ENDPOINT` for trace export.

Previously the TypeScript client read only `PHOENIX_HOST`, so pointing `PHOENIX_COLLECTOR_ENDPOINT` at a remote Phoenix and then reading spans back silently targeted `http://localhost:6006`. The client's base URL now resolves `PHOENIX_ENDPOINT` first, infers from `PHOENIX_COLLECTOR_ENDPOINT` when only that is set — so an existing tracing-only configuration keeps working — and falls back to the legacy `PHOENIX_HOST` (with a one-time warning when a differing `PHOENIX_HOST` loses). The inference runs in that direction only: the OTel SDKs read `PHOENIX_COLLECTOR_ENDPOINT` alone, so trace export behavior is unchanged and the TypeScript and Python SDKs agree on where spans go.

`PHOENIX_BASE_URL` is honored below `PHOENIX_COLLECTOR_ENDPOINT` as an undocumented compatibility fallback. The client docs advertised that name for years while no code read it, so values set from those docs did nothing; placing it below the collector variable means those configurations start working without retargeting anyone who set both.

`@arizeai/phoenix-config` gains `ENV_PHOENIX_ENDPOINT`, `getBaseUrlFromEnvironment[WithSource]()`, `getBaseUrlFromValues()` (same precedence over an injected env record), and `PHOENIX_CONNECTION_ENV_KEYS` (for test env hygiene).
