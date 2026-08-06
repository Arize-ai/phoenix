---
"@arizeai/phoenix-cli": minor
---

`px` now resolves its endpoint from `PHOENIX_ENDPOINT` (canonical for API access), inferring from `PHOENIX_COLLECTOR_ENDPOINT` when only that is set, then the legacy `PHOENIX_HOST` — matching the SDKs and API clients. Previously the CLI read only `PHOENIX_HOST` and silently fell back to `http://localhost:6006`.

`px setup` writes both `PHOENIX_ENDPOINT` and `PHOENIX_COLLECTOR_ENDPOINT` into `.env.phoenix`, since the OTel SDKs read only the collector variable, and every other `px` command run in that directory now honors the file. CLI messages name `PHOENIX_ENDPOINT`.
