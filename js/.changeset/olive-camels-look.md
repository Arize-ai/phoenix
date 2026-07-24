---
"@arizeai/phoenix-cli": minor
---

Add `--span-id` filter to `px span list`, allowing spans to be fetched by OpenTelemetry span ID (requires Phoenix server >= 19.6.0). Add `--until` to bound `px span list` by an exclusive end timestamp, pairing with `--since` for time ranges.
