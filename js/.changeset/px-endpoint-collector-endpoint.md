---
"@arizeai/phoenix-cli": minor
---

`px` now resolves its endpoint from `PHOENIX_ENDPOINT` (canonical for API access), inferring from the trace-export variables `PHOENIX_COLLECTOR_ENDPOINT` and `OTEL_EXPORTER_OTLP_ENDPOINT` when only those are set, then the legacy `PHOENIX_HOST` — matching the SDKs and API clients. Previously the CLI read only `PHOENIX_HOST` and silently fell back to `http://localhost:6006`.

An endpoint merely inferred from a trace-export variable still ranks below an active profile, so exporting one of those variables for application tracing cannot redirect authenticated commands.

`px setup` writes both `PHOENIX_ENDPOINT` and `PHOENIX_COLLECTOR_ENDPOINT` into `.env.phoenix` — the OTel SDKs read the collector variable — and every other `px` command run in that directory now honors the file. CLI messages name `PHOENIX_ENDPOINT`.
