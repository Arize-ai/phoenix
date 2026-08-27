import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";

import {
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
  extractCodeEvaluatorVariablesFromState,
  getCodeEvaluatorCompletionPosition,
  getDefaultCodeEvaluatorSource,
} from "../codeEvaluatorUtils";

describe("the default source a new code evaluator opens on", () => {
  it("names only what its grain hands the evaluator", () => {
    // A dataset example carries a reference and a generated `EvaluatorParams`
    // footer to annotate against; a span or a session carries neither.
    expect(getDefaultCodeEvaluatorSource("TYPESCRIPT", "dataset")).toContain(
      "function evaluate({ output, reference, input, metadata }: EvaluatorParams)"
    );
    expect(getDefaultCodeEvaluatorSource("TYPESCRIPT", "span")).toContain(
      "function evaluate({ input, output, metadata })"
    );
    expect(getDefaultCodeEvaluatorSource("PYTHON", "session")).toContain(
      "def evaluate(input=None, output=None, metadata=None):"
    );
    for (const grain of ["span", "session"] as const) {
      for (const language of ["PYTHON", "TYPESCRIPT"] as const) {
        const source = getDefaultCodeEvaluatorSource(language, grain);
        expect(source).not.toContain("reference");
        expect(source).not.toContain("EvaluatorParams");
      }
    }
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

  it("uses the parsed top-level signature for Python and both TypeScript forms while typing", () => {
    const cases: Array<{
      language: "PYTHON" | "TYPESCRIPT";
      source: string;
      extension: Extension;
      variables: string[];
      position: "signature" | "body";
    }> = [
      {
        language: "PYTHON",
        source: "def evaluate(input, la|",
        extension: python(),
        variables: ["input", "la"],
        position: "signature",
      },
      {
        language: "TYPESCRIPT",
        source:
          "function evaluate({ input, latency_ms }: Params) { return lat|ency_ms; }",
        extension: javascript({ typescript: true }),
        variables: ["input", "latency_ms"],
        position: "body",
      },
      {
        language: "TYPESCRIPT",
        source: "const evaluate = ({ input, la| }: Params) => input;",
        extension: javascript({ typescript: true }),
        variables: ["input", "la"],
        position: "signature",
      },
    ];

    for (const testCase of cases) {
      const pos = testCase.source.indexOf("|");
      const state = EditorState.create({
        doc: testCase.source.replace("|", ""),
        extensions: [testCase.extension],
      });
      expect(
        extractCodeEvaluatorVariablesFromState({
          language: testCase.language,
          state,
        })
      ).toEqual(testCase.variables);
      expect(
        getCodeEvaluatorCompletionPosition({
          language: testCase.language,
          state,
          pos,
        })
      ).toBe(testCase.position);
    }
  });
});
