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
    ).toThrow(/must label the compared items as 'Response A' and 'Response B'/);
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

  it("hits the swap branch on at least one row when seeded", async () => {
    // Strengthens determinism coverage: with a single row, seeded equality
    // can pass even if the swap path is broken. Across a fixture, the
    // seeded RNG must produce both swapped and unswapped orderings.
    const rows = Array.from({ length: 20 }, (_, i) => ({
      output: `o-${i}`,
      reference: `r-${i}`,
      input: `q-${i}`,
    }));
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(rows.map(() => "A")).model,
      promptTemplate,
      ordering: "random",
      seed: 0,
    });

    const mappings: Array<Record<string, string>> = [];
    for (const row of rows) {
      const result = await evaluator.evaluate(row);
      const passes = result.metadata?.passes as
        | Array<{ position_mapping: Record<string, string> }>
        | undefined;
      if (passes?.[0]) {
        mappings.push(passes[0].position_mapping);
      }
    }

    const swapped = mappings.some(
      (m) => m.A === "reference" && m.B === "output"
    );
    const unswapped = mappings.some(
      (m) => m.A === "output" && m.B === "reference"
    );
    expect(swapped).toBe(true);
    expect(unswapped).toBe(true);
  });

  it("omits seed metadata when seed is null (system RNG)", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A"]).model,
      promptTemplate,
      ordering: "fixed",
      seed: null,
    });

    const result = await evaluator.evaluate({
      output: "x",
      reference: "y",
      input: "q",
    });

    expect(result.metadata?.seed).toBeUndefined();
  });

  it.each([
    ["a", "a"],
    ["tie", "b"],
    ["item_1", "x"],
    ["response_1", "x"],
    ["", "b"],
  ] as const)("rejects invalid groups [%s, %s]", (a, b) => {
    expect(
      () =>
        new PairwiseEvaluator({
          name: "pairwise",
          model: createMockModel(["A"]).model,
          promptTemplate,
          groups: [a, b],
        })
    ).toThrow();
  });

  it("rejects prompt templates that reference default group keys", () => {
    expect(
      () =>
        new PairwiseEvaluator({
          name: "pairwise",
          model: createMockModel(["A"]).model,
          promptTemplate: `Question: {{input}}\n\nResponse A: {{output}}\nResponse B: {{item_2}}`,
        })
    ).toThrow();
  });

  it("rejects prompt templates that reference reserved {{response_a}}", () => {
    expect(
      () =>
        new PairwiseEvaluator({
          name: "pairwise",
          model: createMockModel(["A"]).model,
          promptTemplate: `Question: {{input}}\n\nResponse A: {{response_a}}\nResponse B: {{item_2}}`,
        })
    ).toThrow();
  });

  it("returns an explicit tie on a single pass when allowTies is true", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["tie"]).model,
      promptTemplate,
      ordering: "fixed",
      allowTies: true,
    });

    const result = await evaluator.evaluate({
      output: "x",
      reference: "y",
      input: "q",
    });

    expect(result.label).toBe("tie");
    expect(result.score).toBe(0.5);
    expect(result.metadata?.tie_reason).toBeUndefined();
  });

  it("flags explicit_tie when one pass returns tie in both mode", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A", "tie"]).model,
      promptTemplate,
      ordering: "both",
      allowTies: true,
    });

    const result = await evaluator.evaluate({
      output: "x",
      reference: "y",
      input: "q",
    });

    expect(result.label).toBe("tie");
    expect(result.metadata?.tie_reason).toBe("explicit_tie");
  });

  it("rejects eval input missing one of the group keys", async () => {
    const evaluator = new PairwiseEvaluator({
      name: "pairwise",
      model: createMockModel(["A"]).model,
      promptTemplate,
      ordering: "fixed",
    });

    await expect(
      // @ts-expect-error - intentionally missing 'reference'
      evaluator.evaluate({ output: "x", input: "q" })
    ).rejects.toThrow(/requires both/);
  });

  it("winRate throws on empty input", () => {
    expect(() => winRate({ scores: [] })).toThrow(/at least one/);
  });

  it("winRate throws on score without comparator-groups metadata", () => {
    expect(() =>
      winRate({ scores: [{ label: "output", metadata: {} }] })
    ).toThrow(/comparator groups/);
  });

  it("winRate throws on heterogeneous comparator groups", () => {
    expect(() =>
      winRate({
        scores: [
          {
            label: "output",
            metadata: { groups: ["output", "reference"], passes: [] },
          },
          {
            label: "claude",
            metadata: { groups: ["claude", "gpt"], passes: [] },
          },
        ],
      })
    ).toThrow(/share the same/);
  });
});
