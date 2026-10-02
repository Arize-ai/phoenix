---
"@arizeai/phoenix-cli": minor
---

Add `px secret set` (alias `upsert`) and `px secret delete` for admin-only management of Phoenix secrets through `PUT /v1/secrets`. Values are never accepted on the command line: `set` reads them from stdin (piped, or a hidden prompt on a terminal), `--value-file`, `--from-env`, or a dotenv `--env-file`, and sends every source in one atomic request. Both commands report only the affected key names, scrub submitted values from any error text, and reject `KEY=value` arguments without echoing the value. `delete` is gated by `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` like every other delete verb.
