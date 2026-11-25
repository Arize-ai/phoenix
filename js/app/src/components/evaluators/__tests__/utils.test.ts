import { vi } from "vitest";

import {
  createLLMEvaluatorPayload,
  normalizeInputMapping,
  toAnnotationConfigInput,
  updateLLMEvaluatorPayload,
} from "../utils";

vi.mock("@phoenix/pages/playground/playgroundPromptUtils", () => ({
  getInstancePromptParamsFromStore: () => ({
    promptInput: { invocationParameters: null },
    promptVersionId: null,
  }),
}));

const playgroundStore = {} as Parameters<
  typeof updateLLMEvaluatorPayload
>[0]["playgroundStore"];

const inputMapping = {
  pathMapping: { somevar: "input.somevar" },
  literalMapping: { somevar: "foo" },
};

describe("normalizeInputMapping", () => {
  it("removes paths shadowed by literal values without changing the input", () => {
    const mapping = {
      pathMapping: {
        text: "input.text",
        enabled: "input.enabled",
        count: "input.count",
        empty: "input.empty",
        pathOnly: "input.pathOnly",
      },
      literalMapping: { text: "foo", enabled: false, count: 0, empty: "" },
    };

    expect(normalizeInputMapping(mapping)).toEqual({
      pathMapping: { empty: "input.empty", pathOnly: "input.pathOnly" },
      literalMapping: mapping.literalMapping,
    });
    expect(mapping.pathMapping).toHaveProperty("text", "input.text");
  });
});

describe("LLM evaluator payloads", () => {
  it("removes a shadowed path on an unchanged update", () => {
    const input = updateLLMEvaluatorPayload({
      playgroundStore,
      instanceId: 1,
      name: "evaluator",
      description: "",
      outputConfigs: [],
      datasetId: "dataset-id",
      datasetEvaluatorId: "evaluator-id",
      inputMapping,
      includeExplanation: false,
    });

    expect(input.inputMapping).toEqual({
      pathMapping: {},
      literalMapping: { somevar: "foo" },
    });
  });

  it("normalizes the mapping on create", () => {
    const input = createLLMEvaluatorPayload({
      playgroundStore,
      instanceId: 1,
      name: "evaluator",
      description: "",
      outputConfigs: [],
      datasetId: "dataset-id",
      inputMapping,
      includeExplanation: false,
    });

    expect(input.inputMapping).toEqual({
      pathMapping: {},
      literalMapping: { somevar: "foo" },
    });
  });

  it("preserves output config descriptions on update", () => {
    const input = updateLLMEvaluatorPayload({
      playgroundStore,
      instanceId: 1,
      name: "evaluator",
      description: "",
      outputConfigs: [
        {
          name: "relevance",
          description: "Measures whether the reply answers the prompt.",
          optimizationDirection: "MAXIMIZE",
          values: [{ label: "pass", score: 1 }],
        },
      ],
      datasetId: "dataset-id",
      datasetEvaluatorId: "evaluator-id",
      inputMapping,
      includeExplanation: false,
    });

    expect(input.outputConfigs).toEqual([
      {
        categorical: {
          name: "relevance",
          description: "Measures whether the reply answers the prompt.",
          optimizationDirection: "MAXIMIZE",
          values: [{ label: "pass", score: 1 }],
        },
      },
    ]);
  });
});

describe("toAnnotationConfigInput", () => {
  it("preserves description for categorical, continuous, and freeform configs", () => {
    expect(
      toAnnotationConfigInput({
        name: "verdict",
        description: "Pass or fail judgment.",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "pass", score: 1 },
          { label: "fail", score: 0 },
        ],
      })
    ).toEqual({
      categorical: {
        name: "verdict",
        description: "Pass or fail judgment.",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "pass", score: 1 },
          { label: "fail", score: 0 },
        ],
      },
    });

    expect(
      toAnnotationConfigInput({
        name: "score",
        description: "Normalized quality score from 0 to 1.",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      })
    ).toEqual({
      continuous: {
        name: "score",
        description: "Normalized quality score from 0 to 1.",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      },
    });

    expect(
      toAnnotationConfigInput({
        name: "custom",
        description: "Freeform numeric or note annotation.",
        optimizationDirection: "NONE",
        threshold: 0.5,
        lowerBound: 0,
        upperBound: 1,
      })
    ).toEqual({
      freeform: {
        name: "custom",
        description: "Freeform numeric or note annotation.",
        optimizationDirection: "NONE",
        threshold: 0.5,
        lowerBound: 0,
        upperBound: 1,
      },
    });
  });

  it("defaults missing or null description to null across all three config types", () => {
    expect(
      toAnnotationConfigInput({
        name: "verdict",
        optimizationDirection: "MAXIMIZE",
        values: [{ label: "yes" }],
      })
    ).toEqual({
      categorical: {
        name: "verdict",
        description: null,
        optimizationDirection: "MAXIMIZE",
        values: [{ label: "yes", score: null }],
      },
    });

    expect(
      toAnnotationConfigInput({
        name: "score",
        description: null,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({
      continuous: {
        name: "score",
        description: null,
        optimizationDirection: "MINIMIZE",
        lowerBound: null,
        upperBound: null,
      },
    });

    expect(
      toAnnotationConfigInput({
        name: "custom",
        optimizationDirection: "NONE",
        threshold: null,
      })
    ).toEqual({
      freeform: {
        name: "custom",
        description: null,
        optimizationDirection: "NONE",
      },
    });
  });
});
