import { trace } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { generateClassification } from "../../src/llm/generateClassification";

const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

beforeEach(() => {
  trace.setGlobalTracerProvider(provider);
});

afterEach(() => {
  exporter.reset();
  trace.disable();
});

function mockModel() {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: {
        inputTokens: {
          total: 100,
          noCache: 100,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: 150,
          text: 150,
          reasoning: undefined,
        },
      },
      content: [
        {
          type: "text" as const,
          text: '{"explanation": "The answer matches the reference.", "label": "correct"}',
        },
      ],
      warnings: [],
    }),
  });
}

describe("generateClassification telemetry", () => {
  test("exports gen_ai spans through the mounted tracer provider", async () => {
    await generateClassification({
      model: mockModel(),
      labels: ["correct", "incorrect"],
      prompt: "Classify this answer.",
    });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(2);
    for (const span of spans) {
      expect(span.instrumentationScope.name).toBe("phoenix-evals");
    }

    const callSpan = spans.find(
      (span) => span.name === "invoke_agent mock-model-id"
    );
    expect(callSpan).toBeDefined();
    expect(callSpan?.attributes).toMatchObject({
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.agent.name": "generateClassification",
      "gen_ai.provider.name": "mock-provider",
      "gen_ai.request.model": "mock-model-id",
      "gen_ai.output.type": "json",
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": 150,
    });
    // The supplemental `schema: true` integration option records the
    // classification schema.
    expect(callSpan?.attributes["ai.schema"]).toContain('"explanation"');
    expect(callSpan?.attributes["gen_ai.output.messages"]).toContain(
      '\\"label\\":\\"correct\\"'
    );

    const modelSpan = spans.find((span) => span.name === "chat mock-model-id");
    expect(modelSpan).toBeDefined();
    expect(modelSpan?.attributes).toMatchObject({
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "mock-provider",
      "gen_ai.response.model": "mock-model-id",
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": 150,
    });
    // The model call is a child of the generateClassification call span.
    expect(modelSpan?.spanContext().traceId).toBe(
      callSpan?.spanContext().traceId
    );
    expect(modelSpan?.parentSpanContext?.spanId).toBe(
      callSpan?.spanContext().spanId
    );
  });
});

describe("generateClassification telemetry with a decision model", () => {
  test("records the decision state, question and answer on the decide spans", async () => {
    const model = {
      specificationVersion: "v4" as const,
      provider: "mock-provider",
      modelId: "mock-decision-model",
      supportedQuestionTypes: ["choice" as const],
      doDecide: async () => ({
        answers: {
          label: {
            type: "choice" as const,
            choice: "correct",
            probabilities: { correct: 0.9, incorrect: 0.1 },
          },
        },
        usage: { inputTokens: 300, outputTokens: 0 },
        warnings: [],
      }),
    };

    await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      prompt: "Classify this answer.",
    });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(2);
    const [modelSpan, callSpan] = spans;
    for (const span of spans) {
      expect(span.name).toBe("decide mock-decision-model");
      expect(span.instrumentationScope.name).toBe("phoenix-evals");
      expect(span.attributes).toMatchObject({
        "gen_ai.operation.name": "decide",
        "gen_ai.provider.name": "mock-provider",
      });
      // Recorded because the integration enables `experimental_decision`.
      expect(span.attributes["ai.decision.state"]).toContain(
        "Classify this answer."
      );
      expect(span.attributes["ai.decision.answers"]).toContain(
        '"choice":"correct"'
      );
    }
    expect(modelSpan?.attributes["gen_ai.usage.input_tokens"]).toBe(300);
    expect(modelSpan?.parentSpanContext?.spanId).toBe(
      callSpan?.spanContext().spanId
    );
  });
});
