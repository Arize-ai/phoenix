import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";

import { PairwiseEvaluator, createPairwiseQualityEvaluator, winRate } from "../../src";

const promptTemplate = `
Question: {{input}}

Response A:
{{item_1}}

Response B:
{{item_2}}
`;

function createMockModel(choices: string[]) {
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: async (options) => {
      prompts.push(options.prompt);
      const choice = choices[Math.min(prompts.length - 1, choices.length - 1)];
      return {
        finishReason: { unified: "stop", raw: undefined },
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
        content: [
          {
            type: "text",
            text: JSON.stringify({
              label: choice,
              explanation: `picked ${choice}`,
            }),
          },
        ],
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

describe("PairwiseEvaluator", () => {
  it("maps fixed position choices back to group labels", async () => {
    const { model } = createMockModel(["B"]);
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model,
      promptTemplate,
      ordering: "fixed",
    });

    const result = await evaluator.evaluate({
      output: "short",
      reference: "better",
      input: "question",
    });

    expect(result.label).toBe("reference");
    expect(result.score).toBe(0);
    expect(result.metadata?.groups).toEqual(["output", "reference"]);
    expect(result.metadata?.ordering).toBe("fixed");
    expect(result.metadata?.passes).toEqual([
      {
        position_mapping: { A: "output", B: "reference" },
        choice: "B",
        explanation: "picked B",
      },
    ]);
  });

  it("uses deterministic random ordering for the same row and seed", async () => {
    const row = { output: "first", reference: "second", input: "question" };
    const evaluatorOne = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A"]).model,
      promptTemplate,
      ordering: "random",
      seed: 7,
    });
    const evaluatorTwo = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A"]).model,
      promptTemplate,
      ordering: "random",
      seed: 7,
    });

    const resultOne = await evaluatorOne.evaluate(row);
    const resultTwo = await evaluatorTwo.evaluate(row);

    expect(resultOne.metadata?.passes).toEqual(resultTwo.metadata?.passes);
    expect(resultOne.label).toBe(resultTwo.label);
  });

  it("requires semantic agreement in both ordering mode", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A", "B"]).model,
      promptTemplate,
      ordering: "both",
    });

    const result = await evaluator.evaluate({
      output: "better",
      reference: "worse",
      input: "question",
    });

    expect(result.label).toBe("output");
    expect(result.score).toBe(1);
    expect(result.metadata?.passes).toEqual([
      {
        position_mapping: { A: "output", B: "reference" },
        choice: "A",
        explanation: "picked A",
      },
      {
        position_mapping: { A: "reference", B: "output" },
        choice: "B",
        explanation: "picked B",
      },
    ]);
    expect(result.explanation).toBe(
      "Pass 1 (A=output, B=reference): picked A\nPass 2 (A=reference, B=output): picked B"
    );
  });

  it("returns structural ties when swapped passes disagree", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A", "A"]).model,
      promptTemplate,
      ordering: "both",
      allowTies: false,
    });

    const result = await evaluator.evaluate({
      output: "first",
      reference: "second",
      input: "question",
    });

    expect(result.label).toBe("tie");
    expect(result.score).toBe(0.5);
    expect(result.metadata?.tie_reason).toBe("disagreement");
  });

  it("supports custom groups", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A"]).model,
      promptTemplate,
      groups: ["claude", "gpt"],
      ordering: "fixed",
    });

    const result = await evaluator.evaluate({
      claude: "better",
      gpt: "worse",
      input: "question",
    });

    expect(result.label).toBe("claude");
    expect(result.metadata?.groups).toEqual(["claude", "gpt"]);
    expect(result.metadata?.passes).toEqual([
      {
        position_mapping: { A: "claude", B: "gpt" },
        choice: "A",
        explanation: "picked A",
      },
    ]);
  });

  it("rejects invalid prompt templates", () => {
    expect(
      () =>
        new PairwiseEvaluator({
          name: "pairwise",
          model: createMockModel(["A"]).model,
          promptTemplate: "Compare {{item_1}} and {{item_2}}.",
        })
    ).toThrow("must reference the compared items as A and B");
  });

  it("rejects dotted semantic group references in prompt templates", () => {
    expect(
      () =>
        new PairwiseEvaluator({
          name: "pairwise",
          model: createMockModel(["A"]).model,
          promptTemplate: "Response A: {{output.answer}}\nResponse B: {{item_2.answer}}",
        })
    ).toThrow("cannot reference compared group names");
  });

  it("omits explanations when includeExplanation is false", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A"]).model,
      promptTemplate,
      ordering: "fixed",
      includeExplanation: false,
    });

    const result = await evaluator.evaluate({
      output: "one",
      reference: "two",
      input: "question",
    });

    expect(result.explanation).toBeUndefined();
    expect(result.metadata?.passes).toEqual([
      {
        position_mapping: { A: "output", B: "reference" },
        choice: "A",
        explanation: null,
      },
    ]);
  });

  it("calculates win rates with ties", () => {
    expect(
      winRate({
        group: "output",
        scores: [
          { label: "output", metadata: { groups: ["output", "reference"], passes: [] } },
          {
            label: "reference",
            metadata: { groups: ["output", "reference"], passes: [] },
          },
          { label: "tie", metadata: { groups: ["output", "reference"], passes: [] } },
        ],
      })
    ).toEqual({
      group: "output",
      win_rate: 0.5,
      wins: 1,
      losses: 1,
      ties: 1,
      n: 3,
    });
  });

  it("throws on invalid judge output", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["invalid"]).model,
      promptTemplate,
      ordering: "fixed",
    });

    await expect(
      evaluator.evaluate({
        output: "one",
        reference: "two",
        input: "question",
      })
    ).rejects.toThrow();
  });

  it("creates the pairwise quality evaluator", async () => {
    const evaluator = createPairwiseQualityEvaluator({
      model: createMockModel(["tie"]).model,
      ordering: "fixed",
    });

    const result = await evaluator.evaluate({
      output: "one",
      reference: "two",
      input: "question",
    });

    expect(evaluator.name).toBe("pairwise_quality");
    expect(result.label).toBe("tie");
  });
});
