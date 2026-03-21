---
"@arizeai/phoenix-mcp": patch
"@arizeai/phoenix-config": patch
---

Refactor phoenix-mcp internals for consistency and efficiency

- Extract shared pagination helper (`fetchAllPages`) to eliminate duplicated cursor loops
- Centralize constants (limits, defaults, timeouts) into `constants.ts`
- Move `ENV_PHOENIX_PROJECT` to `@arizeai/phoenix-config` for reuse
- Deduplicate `extractSpanIds` into `spanUtils.ts`
- Cache RunLLM MCP client connection across `phoenix-support` tool calls
- Remove legacy identifier fallback patterns (`requirePreferredIdentifier`, `legacyProjectIdentifier`)
