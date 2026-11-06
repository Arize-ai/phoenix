import { OpenTelemetry } from "@ai-sdk/otel";
import { trace } from "@opentelemetry/api";
import { generateObject, type Telemetry } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { generateClassification } from "../../src/llm/generateClassification";

vi.mock(import("ai"), async (importOriginal) => ({
  ...(await importOriginal()),
  generateObject: vi.fn(),
}));

afterEach(() => {
  delete globalThis.AI_SDK_TELEMETRY_INTEGRATIONS;
  vi.mocked(generateObject).mockReset();
});

function mockClassificationResult() {
  vi.mocked(generateObject).mockResolvedValue({
    object: { label: "correct", explanation: "The answer matches." },
  } as Awaited<ReturnType<typeof generateObject>>);
}

function classify(
  telemetry?: Parameters<typeof generateClassification>[0]["telemetry"]
) {
  return generateClassification({
    model: new MockLanguageModelV3({}),
    labels: ["correct", "incorrect"],
    prompt: "Classify this answer.",
    telemetry,
  });
}

function calledIntegrations(): Telemetry[] {
  const telemetry = vi.mocked(generateObject).mock.calls[0]?.[0].telemetry;
  return (telemetry?.integrations ?? []) as Telemetry[];
}

describe("generateClassification", () => {
  test("preserves global integrations while adding Phoenix tracing", async () => {
    const loggingIntegration: Telemetry = { onStart: vi.fn() };
    globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [loggingIntegration];
    mockClassificationResult();

    await classify();

    const integrations = calledIntegrations();
    expect(integrations).toHaveLength(2);
    expect(integrations[0]).toBe(loggingIntegration);
    expect(integrations[1]).toBeInstanceOf(OpenTelemetry);
  });

  test("preserves a global OpenTelemetry integration targeting a different tracer", async () => {
    // An application tracing all of its AI SDK calls to its own backend keeps
    // those spans; the evaluator's Phoenix tracing runs alongside it.
    const appTracingIntegration = new OpenTelemetry({
      tracer: trace.getTracer("app-tracer"),
    });
    globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [appTracingIntegration];
    mockClassificationResult();

    await classify();

    const integrations = calledIntegrations();
    expect(integrations).toHaveLength(2);
    expect(integrations[0]).toBe(appTracingIntegration);
    expect(integrations[1]).toBeInstanceOf(OpenTelemetry);
    expect(integrations[1]).not.toBe(appTracingIntegration);
  });

  test("does not duplicate tracing when a global integration already uses the call's tracer", async () => {
    const evalTracer = trace.getTracer("phoenix-evals");
    const globalTracingIntegration = new OpenTelemetry({ tracer: evalTracer });
    const loggingIntegration: Telemetry = { onStart: vi.fn() };
    globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [
      loggingIntegration,
      globalTracingIntegration,
    ];
    mockClassificationResult();

    await classify({ tracer: evalTracer });

    const integrations = calledIntegrations();
    expect(integrations).toHaveLength(2);
    expect(integrations[0]).toBe(loggingIntegration);
    expect(integrations[1]).toBe(globalTracingIntegration);
  });
});
