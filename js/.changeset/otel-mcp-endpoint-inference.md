---
"@arizeai/phoenix-otel": minor
"@arizeai/phoenix-mcp": minor
---

Resolve endpoints through the shared two-variable scheme: `PHOENIX_COLLECTOR_ENDPOINT` is where traces are exported, `PHOENIX_ENDPOINT` is where API requests go, and when only one is set the other is inferred from it. `register()` now falls back to `PHOENIX_ENDPOINT` when `PHOENIX_COLLECTOR_ENDPOINT` is unset; the MCP server resolves its base URL from `PHOENIX_ENDPOINT` first (previously only `PHOENIX_HOST`, which remains a legacy fallback).
