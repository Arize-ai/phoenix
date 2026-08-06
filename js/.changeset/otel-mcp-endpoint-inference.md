---
"@arizeai/phoenix-mcp": minor
---

Resolve the MCP server's base URL from `PHOENIX_ENDPOINT`, inferring from the trace-export variables `PHOENIX_COLLECTOR_ENDPOINT` and `OTEL_EXPORTER_OTLP_ENDPOINT` when only those are set, then the legacy `PHOENIX_HOST` — matching the API clients and the `px` CLI. Previously the MCP server read only `PHOENIX_HOST`.
