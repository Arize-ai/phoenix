import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClassificationEvaluator } from "../../src";
import { createCriteriaClassifierFn } from "../../src/llm/createClassifierFn";
import type { Criterion } from "../../src/types/evals";

const CRITERIA: Criterion[] = [
  {
    name: "sentiment",
    instruction: "Is the sentiment positive or negative?",
    labels: { positive: null, negative: null },
    scoreMap: { positive: 1, negative: 0 },
  },
  {
    name: "toxicity",
    instruction: "Is the text toxic?",
    labels: { toxic: null, non_toxic: null },
    scoreMap: { toxic: 1, non_toxic: 0 },
  },
];

function createMockModel(labelByCriterion: Record<string, string>) {
  const object = Object.fromEntries(
    Object.entries(labelByCriterion).map(([name, label]) => [
      name,
      { label, explanation: `because ${label}` },
    ])
  );
  return createRawMockModel(object);
}

/** A model that answers with exactly the given object, as JSON. */
function createRawMockModel(object: Record<string, unknown>) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10 },
        outputTokens: { total: 10, text: 10 },
      },
      content: [{ type: "text", text: JSON.stringify(object) }],
      warnings: [],
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createCriteriaClassifierFn", () => {
  it("maps each criterion's label to its score", async () => {
    const classify = createCriteriaClassifierFn({
      model: createMockModel({ sentiment: "positive", toxicity: "toxic" }),
      choices: CRITERIA,
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
    });

    const results = await classify({ text: "whatever" });

    expect(results).toEqual([
      {
        name: "sentiment",
        label: "positive",
        score: 1,
        explanation: "because positive",
        metadata: undefined,
      },
      {
        name: "toxicity",
        label: "toxic",
        score: 1,
        explanation: "because toxic",
        metadata: undefined,
      },
    ]);
  });

  it("keeps the label but leaves the score undefined when a criterion has no scoreMap", async () => {
    const classify = createCriteriaClassifierFn({
      model: createMockModel({ topic: "billing" }),
      choices: [
        {
          name: "topic",
          instruction: "What is the topic?",
          labels: { billing: null, shipping: null },
          // No scoreMap: a bare-label classification.
        },
      ],
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
    });

    const results = await classify({ text: "whatever" });

    expect(results).toEqual([
      {
        name: "topic",
        label: "billing",
        score: undefined,
        explanation: "because billing",
        metadata: undefined,
      },
    ]);
  });

  it("marks a criterion with an off-list label as an invalid_label failure, keeping its siblings", async () => {
    // The model answers "sentiment" with a label that is not in its labels.
    const classify = createCriteriaClassifierFn({
      model: createMockModel({ sentiment: "bogus", toxicity: "toxic" }),
      choices: CRITERIA,
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
    });

    const results = await classify({ text: "whatever" });

    // The bad criterion has no score or label; the failure is surfaced in metadata.
    expect(results[0]).toEqual({
      name: "sentiment",
      metadata: {
        failureKind: "invalid_label",
        failureReason: expect.stringContaining("invalid label 'bogus'"),
      },
    });
    expect(results[0]!.score).toBeUndefined();
    // The sibling is still scored.
    expect(results[1]).toEqual({
      name: "toxicity",
      label: "toxic",
      score: 1,
      explanation: "because toxic",
      metadata: undefined,
    });
  });

  it("passes a declined criterion through as a scoreless failure, keeping its siblings", async () => {
    // The model declines "sentiment" (null) but answers "toxicity".
    const classify = createCriteriaClassifierFn({
      model: createRawMockModel({
        sentiment: null,
        toxicity: { label: "toxic", explanation: "because toxic" },
      }),
      choices: CRITERIA,
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
    });

    const results = await classify({ text: "whatever" });

    expect(results[0]).toEqual({
      name: "sentiment",
      metadata: {
        failureKind: "error",
        failureReason: expect.stringContaining(
          "no answer for criterion 'sentiment'"
        ),
      },
    });
    expect(results[0]!.score).toBeUndefined();
    expect(results[1]!.score).toBe(1);
  });

  it("rejects duplicate criterion names at construction", () => {
    expect(() =>
      createCriteriaClassifierFn({
        model: createMockModel({}),
        choices: [CRITERIA[0]!, CRITERIA[0]!],
        promptTemplate: "Classify: {{text}}",
        telemetry: { isEnabled: false },
      })
    ).toThrow(/unique/);
  });

  it("rejects a criterion with an empty instruction at construction", () => {
    expect(() =>
      createCriteriaClassifierFn({
        model: createMockModel({}),
        choices: [{ name: "sentiment", instruction: "", labels: { a: null } }],
        promptTemplate: "Classify: {{text}}",
        telemetry: { isEnabled: false },
      })
    ).toThrow(/non-empty instruction/);
  });
});

describe("ClassificationEvaluator path selection", () => {
  it("evaluate() throws on a criteria-list evaluator", async () => {
    const evaluator = createClassificationEvaluator({
      name: "multi",
      model: createMockModel({ sentiment: "positive", toxicity: "toxic" }),
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
      choices: CRITERIA,
    });

    await expect(evaluator.evaluate({ text: "whatever" })).rejects.toThrow(
      /evaluateCriteria/
    );
  });

  it("evaluateCriteria() throws on a single-choices-map evaluator", async () => {
    const evaluator = createClassificationEvaluator({
      name: "single",
      model: createMockModel({ single: "positive" }),
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
      choices: { positive: 1, negative: 0 },
    });

    await expect(
      evaluator.evaluateCriteria({ text: "whatever" })
    ).rejects.toThrow(/evaluate\(\)/);
  });
});
