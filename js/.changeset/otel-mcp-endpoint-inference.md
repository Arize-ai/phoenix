---
"@arizeai/phoenix-otel": minor
"@arizeai/phoenix-mcp": minor
---

Resolve the MCP server's base URL from `PHOENIX_ENDPOINT`, inferring from `PHOENIX_COLLECTOR_ENDPOINT` when only that is set, then the legacy `PHOENIX_HOST` — matching the API clients and the `px` CLI. Previously the MCP server read only `PHOENIX_HOST`.

`register()` is unchanged: trace export reads `PHOENIX_COLLECTOR_ENDPOINT` only, so the TypeScript and Python SDKs always agree on where spans go.
