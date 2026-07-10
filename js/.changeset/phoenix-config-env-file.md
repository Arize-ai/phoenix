---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-cli": patch
"@arizeai/phoenix-mcp": patch
"@arizeai/phoenix-otel": patch
---

Add `.env.phoenix` file discovery as a fallback source for Phoenix configuration. When a setting is not present in the process environment, `@arizeai/phoenix-config` walks up from the current working directory to the nearest `.env.phoenix` file and reads `PHOENIX_`-prefixed keys from it (dotenv format). Process environment values take precedence, and related settings (credentials, OTel endpoint/port) are resolved as a group from a single source. Files not owned by the current user are ignored, with one-time warnings for skipped files, for files accessible to other users, and for endpoints paired with credentials from a different source. Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery; call `clearEnvFileCache()` to refresh cached results. Browser builds use a Node-free implementation selected through a conditional package export. `@arizeai/phoenix-cli` ranks discovered values below configured profiles; `@arizeai/phoenix-mcp` and `@arizeai/phoenix-otel` read `.env.phoenix` values through the shared resolution.
