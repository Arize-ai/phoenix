---
"@arizeai/phoenix-mcp": patch
---

Send an explicit `User-Agent: phoenix-mcp` header on Phoenix REST requests. Node's global `fetch` (undici) defaults to `User-Agent: undici`, which some Phoenix Cloud edges 302-redirect to an HTML landing page, causing tool calls to fail with `Unexpected token < in JSON`. Caller-supplied headers still take precedence (#13742).
