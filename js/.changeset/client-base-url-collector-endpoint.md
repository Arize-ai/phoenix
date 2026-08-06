---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-client": minor
---

Introduce `PHOENIX_ENDPOINT` as the canonical base URL for API access, alongside `PHOENIX_COLLECTOR_ENDPOINT` for trace export.

Previously the TypeScript client read only `PHOENIX_HOST`, so pointing `PHOENIX_COLLECTOR_ENDPOINT` at a remote Phoenix and then reading spans back silently targeted `http://localhost:6006`. The client's base URL now resolves `PHOENIX_ENDPOINT` first, then the trace-export variables `PHOENIX_COLLECTOR_ENDPOINT` and `OTEL_EXPORTER_OTLP_ENDPOINT` (any `/v1/traces` path is stripped), then the legacy `PHOENIX_HOST` — matching the Python client rung for rung, so the same environment reaches the same server from either language.

`PHOENIX_BASE_URL` is honored below the trace-export variables as an undocumented compatibility fallback. The client docs advertised that name for years while no code read it, so values set from those docs did nothing; placing it below the other variables means those configurations start working without retargeting anyone who set both. It is also no longer enough on its own to displace a discovered `.env.phoenix`, so a stale value left in a shell cannot redirect a project that `px setup` configured.

Empty and whitespace-only values now count as unset everywhere in the resolution chains, so `export PHOENIX_ENDPOINT=` falls through to the next variable instead of stranding every consumer on localhost.

Experiment and test-suite tracing follow the same rules as `register()`: a client created with an explicit `baseUrl` exports its spans to that server, and a client whose base URL came from the environment lets the trace-export variables decide. An unparseable endpoint in a discovered `.env.phoenix` now falls back with a warning instead of aborting the run, and the cross-tier credential warning fires on this path too.

`@arizeai/phoenix-config` gains `ENV_PHOENIX_ENDPOINT`, `ENV_OTEL_EXPORTER_OTLP_ENDPOINT`, `ENV_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `getBaseUrlFromEnvironment[WithSource]()`, `getBaseUrlFromValues()` (same precedence over an injected env record), `getTraceExportEndpointFromEnvironment()`, and `PHOENIX_CONNECTION_ENV_KEYS` (for test env hygiene).
