import {
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
} from "../codeEvaluatorUtils";

describe("code evaluator variable extraction", () => {
  it.each([
    {
      language: "PYTHON" as const,
      sourceCode:
        "def evaluate(output, reference=None, *, input, metadata=None):\n    return output",
      variables: ["output", "reference", "input", "metadata"],
      requiredVariables: ["output", "input"],
    },
    {
      language: "TYPESCRIPT" as const,
      sourceCode:
        "const evaluate = ({ output, reference, input, metadata }: EvaluatorParams) => output;",
      variables: ["output", "reference", "input", "metadata"],
      requiredVariables: [],
    },
  ])(
    "distinguishes required $language variables",
    ({ language, sourceCode, variables, requiredVariables }) => {
      expect(extractCodeEvaluatorVariables({ language, sourceCode })).toEqual(
        variables
      );
      expect(
        extractRequiredCodeEvaluatorVariables({ language, sourceCode })
      ).toEqual(requiredVariables);
    }
  );
});
