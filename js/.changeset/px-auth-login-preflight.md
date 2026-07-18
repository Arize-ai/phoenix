---
"@arizeai/phoenix-cli": patch
---

`px auth login` now probes the server's `.well-known/oauth-authorization-server` discovery document before starting the browser flow, bailing out cleanly with a network error when the server is unreachable and an auth error when the server does not support OAuth login
