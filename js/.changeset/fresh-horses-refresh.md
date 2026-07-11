---
"@arizeai/phoenix-client": minor
"@arizeai/phoenix-cli": patch
---

Add a reusable refreshable-credential fetch wrapper to the Phoenix TypeScript
client, use it for OAuth-authenticated CLI API and PXI requests, and keep each
profile bound to the endpoint that issued its OAuth tokens.
