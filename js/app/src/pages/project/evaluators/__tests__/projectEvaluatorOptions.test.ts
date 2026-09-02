import {
  buildCopyCodeCreationMode,
  type CodeProjectEvaluatorDetails,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";

const codeEvaluator = {
  __typename: "CodeEvaluator",
  id: "CodeEvaluator:1",
  name: "checks-output",
  description: "Checks the final answer",
  kind: "CODE",
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
