import { vi } from "vitest";

import {
  buildInputSchemaInput,
  buildOutputConfigsInput,
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

describe("buildOutputConfigsInput", () => {
  it("sends a continuous config's threshold only when it has one", () => {
    expect(
      buildOutputConfigsInput([
        {
          annotationType: "CONTINUOUS",
          name: "helpfulness",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 10,
          threshold: 7,
        },
        {
          annotationType: "CONTINUOUS",
          name: "unthresholded",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 10,
          threshold: null,
        },
      ])
    ).toEqual([
      {
        continuous: {
          name: "helpfulness",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 10,
          threshold: 7,
        },
      },
      {
        continuous: {
          name: "unthresholded",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 10,
        },
      },
    ]);
  });

  it("keeps a freeform config freeform", () => {
    expect(
      buildOutputConfigsInput([
        {
          annotationType: "FREEFORM",
          name: "notes",
          optimizationDirection: "NONE",
          threshold: 0.5,
        },
      ])
    ).toEqual([
      {
        freeform: {
          name: "notes",
          optimizationDirection: "NONE",
          threshold: 0.5,
        },
      },
    ]);
  });
});
