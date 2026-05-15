import type { CodeEvaluatorLanguage } from "@phoenix/types";

const PYTHON_INDENT = "    ";
const TYPESCRIPT_INDENT = "  ";

/**
 * Returns the default freeform placeholder source code for a new code
 * evaluator. The placeholder shows the full output shape (a mapping with
 * `score`, `label`, and `explanation`) and a comment explaining the bare
 * shorthands: returning a number is interpreted as a score; returning a
 * string is interpreted as a label.
 *
 * Code evaluators are now freeform — there is no separate "Output type"
 * select — so a single template per language is sufficient.
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
 * Returns all source strings that count as "a generated default" for a
 * given language — used by the language-swap guard to detect whether the
 * editor still holds the placeholder (safe to swap) vs. user-authored
 * code (must not be overwritten). With a single freeform template per
 * language this collapses to a single-element array.
 */
export function getAllGeneratedSources(
  language: CodeEvaluatorLanguage
): string[] {
  return [getDefaultCodeEvaluatorSource(language)];
}

export const DEFAULT_CODE_EVALUATOR_SOURCE: Record<
  CodeEvaluatorLanguage,
  string
> = {
  PYTHON: getDefaultCodeEvaluatorSource("PYTHON"),
  TYPESCRIPT: getDefaultCodeEvaluatorSource("TYPESCRIPT"),
};

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
