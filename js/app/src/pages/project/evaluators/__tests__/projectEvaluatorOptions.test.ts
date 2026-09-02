import {
  buildCopyCodeCreationMode,
  getEvaluatorInputSummaries,
  type CodeProjectEvaluatorDetails,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";

const codeEvaluator = {
  __typename: "CodeEvaluator",
  id: "CodeEvaluator:1",
  name: "checks-output",
  description: "Checks the final answer",
  kind: "CODE",
  codeInputSchema: {
    type: "object",
    properties: { output: {} },
    required: ["output"],
  },
  inputs: [{ name: "output" }],
  language: "TYPESCRIPT",
  sourceCode: "function evaluate(output: string) { return output.length; }",
  sandboxConfig: { id: "SandboxConfig:1" },
  inputMapping: {
    pathMapping: { output: "output.value" },
    literalMapping: { threshold: 5 },
  },
  outputConfigs: [
    {
      __typename: "ContinuousAnnotationConfig",
      name: "length",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: null,
    },
  ],
  " $fragmentType": "projectEvaluatorOptions_codeEvaluatorDetails",
} satisfies CodeProjectEvaluatorDetails;

describe("buildCopyCodeCreationMode", () => {
  it("seeds a new code evaluator from the source definition", () => {
    expect(buildCopyCodeCreationMode(codeEvaluator)).toEqual({
      kind: "copyCode",
      initialState: {
        name: "checks-output",
        copyName: "checks-output-copy",
        description: "Checks the final answer",
        language: "TYPESCRIPT",
        sourceCode:
          "function evaluate(output: string) { return output.length; }",
        sandboxConfigId: "SandboxConfig:1",
        inputMapping: {
          pathMapping: { output: "output.value" },
          literalMapping: { threshold: 5 },
        },
        outputConfigs: [
          {
            name: "length",
            optimizationDirection: "MAXIMIZE",
            lowerBound: 0,
            upperBound: null,
          },
        ],
      },
    });
  });

  it("allows the duplicate form to require a replacement sandbox", () => {
    expect(
      buildCopyCodeCreationMode({
        ...codeEvaluator,
        sandboxConfig: null,
      }).initialState.sandboxConfigId
    ).toBeNull();
  });
});

describe("getEvaluatorInputSummaries", () => {
  it("returns names and available type and description metadata", () => {
    expect(
      getEvaluatorInputSummaries({
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "The input to evaluate",
          },
          context: {},
          score: {
            anyOf: [{ type: "number" }, { type: "null" }],
          },
        },
      })
    ).toEqual([
      {
        name: "input",
        type: "string",
        description: "The input to evaluate",
      },
      { name: "context", type: undefined, description: undefined },
      { name: "score", type: "number | null", description: undefined },
    ]);
  });

  it("returns no inputs when the schema has no property map", () => {
    expect(getEvaluatorInputSummaries(null)).toEqual([]);
    expect(getEvaluatorInputSummaries({ type: "object" })).toEqual([]);
  });
});
