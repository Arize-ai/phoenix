---
"@arizeai/phoenix-client": minor
---

Add server version gating to phoenix-client. The client now reads the server version from response headers and validates it against minimum version requirements before calling newer API routes or using newer parameters. This prevents confusing errors when a client is newer than the server it connects to.
