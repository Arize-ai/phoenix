---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-client": minor
---

Introduce `PHOENIX_ENDPOINT` as the canonical variable for API access, alongside `PHOENIX_COLLECTOR_ENDPOINT` for trace export. The client's base URL now resolves `PHOENIX_ENDPOINT` first, then its documented alias `PHOENIX_BASE_URL` (previously advertised in the client docs but read by nothing), infers from `PHOENIX_COLLECTOR_ENDPOINT` when only that is set, and falls back to the legacy `PHOENIX_HOST` (with a one-time warning when a differing `PHOENIX_HOST` loses). Previously the TypeScript client read only `PHOENIX_HOST`, so pointing `PHOENIX_COLLECTOR_ENDPOINT` at a remote Phoenix while reading spans back silently targeted `http://localhost:6006`. `@arizeai/phoenix-config` gains `ENV_PHOENIX_ENDPOINT`, `ENV_PHOENIX_BASE_URL`, `getBaseUrlFromEnvironment[WithSource]()` (API access), `getCollectorEndpointFromEnvironment[WithSource]()` (trace export, inferring from the API variables), `getBaseUrlFromValues()` (same precedence over an injected env record), and `PHOENIX_CONNECTION_ENV_KEYS` (for test env hygiene).
