---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-client": minor
---

Resolve the client base URL from `PHOENIX_COLLECTOR_ENDPOINT`, matching the Python client's precedence: `PHOENIX_COLLECTOR_ENDPOINT` first, then `PHOENIX_HOST`, resolved as one tier group with a one-time warning when the two are set to different values. Previously the TypeScript client read only `PHOENIX_HOST`, so pointing `PHOENIX_COLLECTOR_ENDPOINT` at a remote Phoenix while reading spans back silently targeted `http://localhost:6006`. `@arizeai/phoenix-config` gains `getBaseUrlFromEnvironment()` and `getBaseUrlFromEnvironmentWithSource()`.
