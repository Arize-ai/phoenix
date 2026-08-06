---
"@arizeai/phoenix-otel": minor
---

`register()` now resolves where traces are exported from a ranked chain instead of `PHOENIX_COLLECTOR_ENDPOINT` alone: an explicit `url`, then `PHOENIX_COLLECTOR_ENDPOINT`, then the OpenTelemetry-standard `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (used verbatim, per the specification) and `OTEL_EXPORTER_OTLP_ENDPOINT` (a base URL the OTLP traces path is appended to), then `PHOENIX_ENDPOINT`, then `http://localhost:6006`.

Configurations that set `PHOENIX_COLLECTOR_ENDPOINT` are unchanged. What changes is the case that previously lost every span: setting only `PHOENIX_ENDPOINT` or only the OpenTelemetry variables exported to localhost, where nothing was listening. Those spans now reach the server that was named. When trace export resolves below `PHOENIX_COLLECTOR_ENDPOINT`, an informational line states which variable supplied the destination, so the resolution is visible rather than assumed.

`PHOENIX_COLLECTOR_ENDPOINT` accepts either a base URL or a full OTLP traces URL: the `/v1/traces` path is appended when missing and left alone when present, and a doubled separator or trailing slash on that path is canonicalized so exporters reach the route directly. Empty and whitespace-only values count as unset and fall through to the next variable.
