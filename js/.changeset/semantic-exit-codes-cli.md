---
"@arizeai/phoenix-cli": minor
---

Add semantic exit codes to the CLI for scripting and CI integration.

Commands now exit with meaningful codes instead of always using `1` on failure:

| Code | Meaning | Description |
|------|---------|-------------|
| `0` | Success | Command completed successfully |
| `1` | Failure | Unspecified or unexpected error |
| `2` | Cancelled | User cancelled the operation |
| `3` | Invalid argument | Bad CLI flags, missing required args, or invalid input |
| `4` | Auth required | Not authenticated or insufficient permissions |
| `5` | Network error | Failed to connect to server or network request failed |
