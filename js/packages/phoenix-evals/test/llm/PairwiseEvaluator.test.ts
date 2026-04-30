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
      a: "short",
      b: "better",
      input: "question",
    });

    expect(result.label).toBe("b");
    expect(result.score).toBe(0);
    expect(result.metadata?.presented_first).toBe("a");
    expect(result.metadata?.judge_choice_pass_1).toBe("B");
  });

  it("uses deterministic random ordering for the same row and seed", async () => {
    const row = { a: "first", b: "second", input: "question" };
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

    expect(resultOne.metadata?.presented_first).toBe(resultTwo.metadata?.presented_first);
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
      a: "better",
      b: "worse",
      input: "question",
    });

    expect(result.label).toBe("a");
    expect(result.score).toBe(1);
    expect(result.metadata?.judge_choice_pass_1).toBe("A");
    expect(result.metadata?.judge_choice_pass_2).toBe("B");
    expect(result.explanation).toContain("[Consensus: agreed -> winner=a]");
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
      a: "first",
      b: "second",
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
    expect(result.metadata?.claude).toBe("better");
    expect(result.metadata?.gpt).toBe("worse");
  });

  it("rejects invalid prompt templates", () => {
    expect(
      () =>
        new PairwiseEvaluator({
          name: "pairwise",
          model: createMockModel(["A"]).model,
          promptTemplate: "Compare {{a}} and {{item_1}}",
        })
    ).toThrow("must reference both");
  });

  it("calculates win rates with ties", () => {
    expect(
      winRate({
        group: "a",
        scores: [
          { label: "a", metadata: { a: "one", b: "two" } },
          { label: "b", metadata: { a: "one", b: "two" } },
          { label: "tie", metadata: { a: "one", b: "two" } },
        ],
      })
    ).toBe(0.5);
  });

  it("creates the pairwise quality evaluator", async () => {
    const evaluator = createPairwiseQualityEvaluator({
      model: createMockModel(["tie"]).model,
      ordering: "fixed",
    });

    const result = await evaluator.evaluate({
      a: "one",
      b: "two",
      input: "question",
    });

    expect(evaluator.name).toBe("pairwise_quality");
    expect(result.label).toBe("tie");
  });
});
