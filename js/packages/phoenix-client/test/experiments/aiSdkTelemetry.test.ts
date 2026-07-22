import { OpenTelemetry } from "@ai-sdk/otel";
import { detachGlobalTracerProvider, register } from "@arizeai/phoenix-otel";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { generateText, type Telemetry } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, test } from "vitest";

import {
  registerAiSdkTelemetry,
  resetAiSdkTelemetryRegistrationForTesting,
} from "../../src/experiments/aiSdkTelemetry";

type GlobalWithAiSdkTelemetry = typeof globalThis & {
  AI_SDK_TELEMETRY_INTEGRATIONS?: Telemetry[];
};

function getGlobalIntegrations(): Telemetry[] | undefined {
  return (globalThis as GlobalWithAiSdkTelemetry).AI_SDK_TELEMETRY_INTEGRATIONS;
}

function clearGlobalIntegrations(): void {
  delete (globalThis as GlobalWithAiSdkTelemetry).AI_SDK_TELEMETRY_INTEGRATIONS;
}

function createMockModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: 20,
          text: 20,
          reasoning: undefined,
        },
      },
      content: [{ type: "text" as const, text: "Hello, world!" }],
      warnings: [],
    }),
  });
}

afterEach(() => {
  detachGlobalTracerProvider();
  clearGlobalIntegrations();
  resetAiSdkTelemetryRegistrationForTesting();
});

describe("registerAiSdkTelemetry", () => {
  test("registers once without replacing application integrations", async () => {
    const loggingIntegration: Telemetry = { onStart: () => {} };
    (globalThis as GlobalWithAiSdkTelemetry).AI_SDK_TELEMETRY_INTEGRATIONS = [
      loggingIntegration,
    ];

    await expect(registerAiSdkTelemetry()).resolves.toBe(true);
    await expect(registerAiSdkTelemetry()).resolves.toBe(true);

    expect(getGlobalIntegrations()).toHaveLength(2);
    expect(getGlobalIntegrations()?.[0]).toBe(loggingIntegration);
    expect(getGlobalIntegrations()?.[1]).toBeInstanceOf(OpenTelemetry);
  });

  test("uses an existing OpenTelemetry integration", async () => {
    const applicationIntegration = new OpenTelemetry();
    (globalThis as GlobalWithAiSdkTelemetry).AI_SDK_TELEMETRY_INTEGRATIONS = [
      applicationIntegration,
    ];

    await expect(registerAiSdkTelemetry()).resolves.toBe(true);
    expect(getGlobalIntegrations()).toEqual([applicationIntegration]);
  });

  test("does not export request headers and uses a Phoenix scope", async () => {
    const exporter = new InMemorySpanExporter();
    await registerAiSdkTelemetry();
    const provider = register({
      projectName: "ai-sdk-test",
      spanProcessors: [new SimpleSpanProcessor(exporter)],
      global: true,
    });

    try {
      await generateText({
        model: createMockModel(),
        prompt: "Say hello.",
        headers: {
          authorization: "Bearer secret-token",
          cookie: "session=secret-cookie",
        },
      });
      await provider.forceFlush();

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBeGreaterThan(0);
      expect(
        spans.some(
          (span) =>
            span.instrumentationScope.name === "@arizeai/phoenix-client/ai-sdk"
        )
      ).toBe(true);

      const serializedAttributes = JSON.stringify(
        spans.map((span) => span.attributes)
      );
      expect(serializedAttributes).not.toContain("secret-token");
      expect(serializedAttributes).not.toContain("secret-cookie");
      expect(serializedAttributes).not.toContain("ai.request.headers");
    } finally {
      await provider.shutdown();
    }
  });
});
