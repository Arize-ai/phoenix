---
"@arizeai/phoenix-cli": minor
---

Add `px setup doctor`, which checks the settings file and profile, server connectivity, the server version, and authentication, and prints pass/fail/skip for each check with a fix hint. `--format json|raw` prints `{ checks: [{ name, status, message, fix }] }`.
