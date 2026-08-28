import {
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
  getDefaultCodeEvaluatorSource,
  getNextCodeEvaluatorSource,
} from "../codeEvaluatorUtils";

describe("getNextCodeEvaluatorSource", () => {
  it("swaps a generated placeholder for the next language's placeholder", () => {
    expect(
      getNextCodeEvaluatorSource({
        sourceCode: getDefaultCodeEvaluatorSource("PYTHON"),
        language: "PYTHON",
        nextLanguage: "TYPESCRIPT",
      })
    ).toEqual(getDefaultCodeEvaluatorSource("TYPESCRIPT"));
  });

  it("never overwrites user-authored code", () => {
    const sourceCode = "def evaluate(output):\n    return 1.0\n";
    expect(
      getNextCodeEvaluatorSource({
        sourceCode,
        language: "PYTHON",
        nextLanguage: "TYPESCRIPT",
      })
    ).toEqual(sourceCode);
  });
});

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
