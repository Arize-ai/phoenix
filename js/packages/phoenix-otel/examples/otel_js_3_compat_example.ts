// Self-checking smoke test for OpenTelemetry JS 3 compatibility. It needs no
// Phoenix server: spans go to an in-memory exporter. Run it with
// `pnpm exec tsx examples/otel_js_3_compat_example.ts`; it exits 1 on failure.

/* eslint-disable no-console */
import { trace as apiTrace } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace";

import { register, traceChain, traceTool } from "../src";

function check(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok: ${message}`);
}

async function main() {
  const exporter = new InMemorySpanExporter();
  const provider = register({
    projectName: "otel-js-3-compat-example",
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });

  const tracer = apiTrace.getTracer("app");
  const probe = tracer.startSpan("probe");
  check(probe.isRecording(), "spans from @opentelemetry/api are recording");
  probe.end();

  tracer.startActiveSpan("parent", (parent) => {
    tracer.startSpan("child").end();
    parent.end();
  });

  const lookup = traceTool(async (id: string) => `item-${id}`, {
    name: "lookup",
  });
  const pipeline = traceChain(async (id: string) => lookup(id), {
    name: "pipeline",
  });
  await pipeline("1");

  const spans = exporter.getFinishedSpans();
  const byName = (name: string) => spans.find((span) => span.name === name);
  const parentOf = (name: string) => byName(name)?.parentSpanContext?.spanId;

  check(
    parentOf("child") === byName("parent")?.spanContext().spanId,
    "startActiveSpan child is parented to its active span"
  );
  check(
    parentOf("lookup") === byName("pipeline")?.spanContext().spanId,
    "traceTool span is parented to the enclosing traceChain span"
  );
  check(
    byName("pipeline")?.resource.attributes["openinference.project.name"] ===
      "otel-js-3-compat-example",
    "project name is set on the resource"
  );

  await provider.shutdown();
  check(
    !apiTrace.getTracer("app").startSpan("after-shutdown").isRecording(),
    "shutdown detaches the global provider"
  );

  process.env.OTEL_TRACES_SAMPLER = "always_off";
  const sampledOut = register({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
    global: false,
  });
  check(
    !sampledOut.getTracer("app").startSpan("off").isRecording(),
    "OTEL_TRACES_SAMPLER=always_off is honored"
  );
  delete process.env.OTEL_TRACES_SAMPLER;
  await sampledOut.shutdown();
}

main();
