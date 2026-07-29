---
"@arizeai/phoenix-cli": patch
---

Tell the `px setup` instrumentation agent that `PHOENIX_COLLECTOR_ENDPOINT` is a base URL and that exporters taking a full OTLP URL (such as `@mastra/arize`'s `ArizeExporter`) must be given `<endpoint>/v1/traces`, and name that mistake in the "traces not verified" note. Pointing such an exporter at the base URL drops every span without erroring.
