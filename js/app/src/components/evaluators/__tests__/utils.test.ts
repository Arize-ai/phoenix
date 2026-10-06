import { vi } from "vitest";

import {
  createLLMEvaluatorPayload,
  getDeclaredInputBindings,
  normalizeInputMapping,
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

describe("getDeclaredInputBindings", () => {
  const mapping = {
    pathMapping: {
      question: "input.question",
      removed: "input.removed",
      shadowed: "input.shadowed",
      empty: "",
    },
    literalMapping: { shadowed: false, removedLiteral: "x" },
  };

  it("returns one binding per declared variable and ignores undeclared entries", () => {
    expect(
      getDeclaredInputBindings({
        variables: ["question", "shadowed", "empty", "added"],
        inputMapping: mapping,
      })
    ).toEqual([
      { variable: "question", kind: "path", path: "input.question" },
      { variable: "shadowed", kind: "literal", value: false },
      { variable: "empty", kind: "unmapped" },
      { variable: "added", kind: "unmapped" },
    ]);
  });

  it("treats every mapped key as declared when the variables are unknown", () => {
    expect(
      getDeclaredInputBindings({ variables: null, inputMapping: mapping }).map(
        ({ variable, kind }) => [variable, kind]
      )
    ).toEqual([
      ["question", "path"],
      ["removed", "path"],
      ["shadowed", "literal"],
      ["empty", "unmapped"],
      ["removedLiteral", "literal"],
    ]);
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
});
