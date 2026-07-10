---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-cli": patch
"@arizeai/phoenix-mcp": patch
"@arizeai/phoenix-otel": patch
---

Harden `.env.phoenix` discovery: resolve credentials (API key + client headers) and related settings as source-aware tier groups so file values are never mixed with process-environment values; preserve explicit authorization case-insensitively; verify file trust on the opened descriptor; warn when a file is skipped or supplies an endpoint paired with higher-tier credentials; and add explicit cache refresh helpers. The Phoenix CLI ranks discovered values below configured profiles, and browser builds now select the Node-free discovery implementation through a conditional package export.
