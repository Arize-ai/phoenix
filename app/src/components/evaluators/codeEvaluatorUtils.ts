import type { CodeEvaluatorLanguage } from "@phoenix/types";

const PYTHON_INDENT = "    ";
const TYPESCRIPT_INDENT = "  ";

/**
 * Returns the default placeholder source code for a new code evaluator.
 * The placeholder shows the full `{score, label, explanation}` return
 * shape alongside the bare shorthands (number → score, string → label).
 */
export function getDefaultCodeEvaluatorSource(
  language: CodeEvaluatorLanguage
): string {
  if (language === "PYTHON") {
    return `def evaluate(output, reference=None, input=None, metadata=None):
${PYTHON_INDENT}# return 1.0     # numbers are recorded as scores
${PYTHON_INDENT}# return "pass"  # strings are recorded as labels
${PYTHON_INDENT}return {"score": 1.0, "label": "pass", "explanation": "..."}
`;
  }
  // TYPESCRIPT
  return `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
${TYPESCRIPT_INDENT}// return 1;        // numbers are recorded as scores
${TYPESCRIPT_INDENT}// return "pass";   // strings are recorded as labels
${TYPESCRIPT_INDENT}return { score: 1, label: "pass", explanation: "..." };
}
`;
}

/**
 * Returns every source string the language-swap guard treats as a
 * generated default — i.e., placeholders that are safe to overwrite on
 * language change. User-authored code must not appear in this set.
 */
export function getAllGeneratedSources(
  language: CodeEvaluatorLanguage
): string[] {
  return [getDefaultCodeEvaluatorSource(language)];
}

export const extractCodeEvaluatorVariables = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}) => {
  if (language === "PYTHON") {
    return extractPythonVariables(sourceCode);
  }
  return extractTypeScriptVariables(sourceCode);
};

function extractPythonVariables(sourceCode: string) {
  const match = sourceCode.match(/def\s+evaluate\s*\(([^)]*)\)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\*+/, ""))
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .map((part) => part.split(":")[0]?.trim() ?? "")
    .filter(Boolean)
    .filter((part) => part !== "/")
    .filter(unique);
}

function extractTypeScriptVariables(sourceCode: string) {
  const signature =
    sourceCode.match(/function\s+evaluate\s*\(([^)]*)\)/) ??
    sourceCode.match(/(?:const|let|var)\s+evaluate\s*=\s*\(([^)]*)\)\s*=>/);
  if (!signature) {
    return [];
  }
  const params = signature[1]?.trim() ?? "";
  if (!params) {
    return [];
  }
  const destructured = params.match(/^\{([^}]*)\}/);
  if (destructured) {
    return destructured[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(":")[0]?.trim() ?? "")
      .map((part) => part.split("=")[0]?.trim() ?? "")
      .map((part) => part.replace(/\?$/, "").trim())
      .filter(Boolean)
      .filter(unique);
  }
  return [];
}

function unique(value: string, index: number, values: string[]) {
  return values.indexOf(value) === index;
}
