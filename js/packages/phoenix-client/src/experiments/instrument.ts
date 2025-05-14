import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { HeadersOptions } from "openapi-fetch";

export function instrument({
  projectName,
  collectorEndpoint,
  headers,
}: {
  projectName?: string;
  headers: HeadersOptions;
  collectorEndpoint: string;
}) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [SEMRESATTRS_PROJECT_NAME]: projectName,
    }),
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: `${collectorEndpoint}/v1/traces`,
          headers: Array.isArray(headers)
            ? Object.fromEntries(headers)
            : headers,
        })
      ),
    ],
  });

  provider.register();
}
