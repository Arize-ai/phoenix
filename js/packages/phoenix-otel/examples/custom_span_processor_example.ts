// Custom span processors. BatchSpanProcessor and SimpleSpanProcessor are
// re-exported from @arizeai/phoenix-otel and take an options object.

/* eslint-disable no-console */
import {
  BatchSpanProcessor,
  ensureCollectorEndpoint,
  OTLPTraceExporter,
  register,
  type SpanProcessor,
} from "../src";

const logSpanNames: SpanProcessor = {
  onStart: () => {},
  onEnd: (span) => {
    console.log(`ended span: ${span.name}`);
  },
  forceFlush: async () => {},
  shutdown: async () => {},
};

async function main() {
  const exporter = new OTLPTraceExporter({
    url: ensureCollectorEndpoint(
      process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006"
    ),
    headers: process.env.PHOENIX_API_KEY
      ? { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` }
      : undefined,
  });

  const provider = register({
    projectName: "custom-span-processor-example",
    spanProcessors: [new BatchSpanProcessor({ exporter }), logSpanNames],
    global: false,
  });

  const tracer = provider.getTracer("custom-span-processor-example");
  tracer.startActiveSpan("parent", (parent) => {
    tracer.startSpan("child").end();
    parent.end();
  });

  await provider.shutdown();
}

main();
