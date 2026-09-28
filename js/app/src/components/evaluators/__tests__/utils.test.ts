import { vi } from "vitest";

import { createLLMEvaluatorPayload, updateLLMEvaluatorPayload } from "../utils";

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
});
