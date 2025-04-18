// instrumentation.ts
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  Span,
  trace,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import openai from "openai";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

import {
  OpenInferenceSpanKind,
  SemanticConventions,
  SEMRESATTRS_PROJECT_NAME,
} from "@arizeai/openinference-semantic-conventions";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "my-llm-app",
    // defaults to "default" in the Phoenix UI
    [SEMRESATTRS_PROJECT_NAME]: "my-llm-app",
  }),
  spanProcessors: [
    // BatchSpanProcessor will flush spans in batches after some time,
    // this is recommended in production. For development or testing purposes
    // you may try SimpleSpanProcessor for instant span flushing to the Phoenix UI.
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: `http://localhost:6006/v1/traces`,
        // (optional) if connecting to Phoenix Cloud
        // headers: { "api_key": process.env.PHOENIX_API_KEY },
        // (optional) if connecting to self-hosted Phoenix with Authentication enabled
        // headers: { "Authorization": `Bearer ${process.env.PHOENIX_API_KEY}` }
      })
    ),
  ],
});

provider.register();

const openAIInstrumentation = new OpenAIInstrumentation({});
// @ts-ignore
openAIInstrumentation.manuallyInstrument(openai);

registerInstrumentations({
  instrumentations: [openAIInstrumentation],
});

const tracer = trace.getTracer("Sample", "1.0.0");

// Option 1: Fix by changing the decorator to handle method with a single argument
export function Trace<A, R>(
  traceName: string,
  traceFunction: (span: Span, arg: A, result: R) => void
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (arg: A) {
      return await tracer.startActiveSpan(traceName, async (span: Span) => {
        const result = await originalMethod.call(this, arg);
        traceFunction(span, arg, result);
        span.end();
        return result;
      });
    };
    return descriptor;
  };
}

function traceQueryModel(span: Span, query: string, result: unknown) {
  console.log("Setting span attributes for queryModel", query, result);
  span.setAttributes({
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
      OpenInferenceSpanKind.RETRIEVER,
    [SemanticConventions.INPUT_VALUE]: query,
    [SemanticConventions.OUTPUT_VALUE]: JSON.stringify(result || {}),
  });
}

// Usage remains the same:
class SampleService {
  @Trace("queryModel", traceQueryModel)
  async queryModel(query: string) {
    // do something in here with query and return "result"
    return "result";
  }
}

const sampleService = new SampleService();
sampleService.queryModel("test");
