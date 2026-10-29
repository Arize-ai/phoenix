import { vi } from "vitest";

import {
  buildInputSchemaInput,
  createLLMEvaluatorPayload,
  getInputDescriptionsFromSchema,
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

describe("buildInputSchemaInput", () => {
  it("lists every declared input and describes the ones with text", () => {
    expect(
      buildInputSchemaInput({
        variables: ["input", "output"],
        inputDescriptions: { output: "  The response.  ", removed: "Gone" },
      })
    ).toEqual({
      type: "object",
      properties: { input: {}, output: { description: "The response." } },
    });
  });
});

describe("getInputDescriptionsFromSchema", () => {
  it("reads non-empty string descriptions by input name", () => {
    expect(
      getInputDescriptionsFromSchema({
        type: "object",
        properties: {
          input: { type: "string", description: "The question." },
          context: {},
          blank: { description: "  " },
          wrong: { description: 3 },
        },
      })
    ).toEqual({ input: "The question." });
  });

  it("ignores anything that is not a schema object", () => {
    expect(getInputDescriptionsFromSchema(null)).toEqual({});
    expect(getInputDescriptionsFromSchema("x")).toEqual({});
    expect(getInputDescriptionsFromSchema({ properties: [] })).toEqual({});
  });
});
