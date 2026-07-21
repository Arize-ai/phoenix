import {
  InMemorySpanExporter,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import { describe, expect, test } from "vitest";

import { LazyOpenInferenceSpanProcessor } from "../src/lazyOpenInferenceSpanProcessor";

describe("LazyOpenInferenceSpanProcessor", () => {
  test("exports spans recorded before the delegate finishes loading", async () => {
    const exporter = new InMemorySpanExporter();
    const processor = new LazyOpenInferenceSpanProcessor({
      exporter,
      batch: false,
    });
    const provider = new NodeTracerProvider({ spanProcessors: [processor] });

    // Record a span synchronously — before the dynamic import of
    // @arizeai/openinference-vercel can possibly have resolved.
    provider.getTracer("lazy-test").startSpan("early-span").end();

    await provider.forceFlush();
    expect(exporter.getFinishedSpans().map((span) => span.name)).toContain(
      "early-span"
    );

    await provider.shutdown();
  });

  test("delegates spans recorded after the load completes", async () => {
    const exporter = new InMemorySpanExporter();
    const processor = new LazyOpenInferenceSpanProcessor({
      exporter,
      batch: false,
    });
    const provider = new NodeTracerProvider({ spanProcessors: [processor] });

    // forceFlush awaits the delegate, so the processor is loaded after this.
    await provider.forceFlush();

    provider.getTracer("lazy-test").startSpan("late-span").end();
    await provider.forceFlush();

    expect(exporter.getFinishedSpans().map((span) => span.name)).toContain(
      "late-span"
    );

    await provider.shutdown();
  });
});
