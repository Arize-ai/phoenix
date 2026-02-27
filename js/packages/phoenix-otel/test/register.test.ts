import { context } from "@opentelemetry/api";
import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { describe, expect, test } from "vitest";

import { DiagLogLevel } from "../src";
import { ensureCollectorEndpoint, register } from "../src/register";

describe("register", () => {
  test("should register a provider and invoke custom span processor", () => {
    let onStartCalls = 0;
    const mockProcessor: SpanProcessor = {
      onStart: () => {
        onStartCalls += 1;
      },
      onEnd: (_span: Readonly<Span>) => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [mockProcessor],
      global: false,
    });
    expect(provider).toBeDefined();

    const tracer = provider.getTracer("register-test");
    tracer.startSpan("smoke-span", undefined, context.active()).end();
    expect(onStartCalls).toBe(1);
  });

  test("should accept diag log level from package exports", () => {
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      diagLogLevel: DiagLogLevel.DEBUG,
      global: false,
    });
    expect(provider).toBeDefined();
  });
});

test("should export DiagLogLevel as a runtime value", () => {
  expect(DiagLogLevel.DEBUG).toBeDefined();
  expect(typeof DiagLogLevel.DEBUG).toBe("number");
});

test.each([
  ["http://localhost:6006", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces/", "http://localhost:6006/v1/traces/"],
  [
    "https://app.phoenix.arize.com/s/my-space",
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
  ],
  [
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
  ],
])("ensureCollectorEndpoint(%0) should return %1", (url, collectorURL) => {
  expect(ensureCollectorEndpoint(url)).toBe(collectorURL);
});
