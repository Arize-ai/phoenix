import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, test } from "vitest";

import { getTracer } from "../src/getTracer";
import {
  attachGlobalTracerProvider,
  detachGlobalTracerProvider,
  register,
} from "../src/register";

afterEach(() => {
  detachGlobalTracerProvider();
});

function registerWithExporter(projectName: string) {
  const exporter = new InMemorySpanExporter();
  const provider = register({
    projectName,
    url: "http://localhost:6006/v1/traces",
    spanProcessors: [new SimpleSpanProcessor(exporter)],
    global: false,
  });
  return { exporter, provider };
}

describe("getTracer", () => {
  test("a tracer created before attach follows the attached provider", () => {
    const tracer = getTracer("swap-safe");

    const { exporter, provider } = registerWithExporter("attached-later");
    const registration = attachGlobalTracerProvider(provider);
    try {
      tracer.startSpan("task-span").end();
      expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual([
        "task-span",
      ]);
    } finally {
      registration.detach();
    }
  });

  test("follows provider swaps across attach/detach", () => {
    const first = registerWithExporter("first");
    const second = registerWithExporter("second");
    const tracer = getTracer("swap-safe");

    const firstRegistration = attachGlobalTracerProvider(first.provider);
    tracer.startSpan("first-span").end();

    const secondRegistration = attachGlobalTracerProvider(second.provider);
    tracer.startSpan("second-span").end();
    secondRegistration.detach();

    tracer.startSpan("back-on-first-span").end();
    firstRegistration.detach();

    expect(first.exporter.getFinishedSpans().map((span) => span.name)).toEqual([
      "first-span",
      "back-on-first-span",
    ]);
    expect(
      second.exporter.getFinishedSpans().map((span) => span.name)
    ).toEqual(["second-span"]);
  });
});
