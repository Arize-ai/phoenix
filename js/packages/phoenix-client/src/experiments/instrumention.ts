import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { HeadersOptions } from "openapi-fetch";

export function register({
  projectName,
  collectorEndpoint,
  headers,
}: {
  projectName?: string;
  headers: HeadersOptions;
  collectorEndpoint: string;
}) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  // do not create a new tracer provider if one already exists on the consuming side
  const existingProvider = trace.getTracerProvider();
  if (existingProvider) {
    return existingProvider as NodeTracerProvider;
  }

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

  return provider;
}
