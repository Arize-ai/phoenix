import type { CodeEvaluatorLanguage } from "@phoenix/types";

export const DEFAULT_CODE_EVALUATOR_SOURCE: Record<
  CodeEvaluatorLanguage,
  string
> = {
  PYTHON: `def evaluate(output, reference=None, input=None, metadata=None):
    candidate = output.get("answer", "") if isinstance(output, dict) else ""
    expected = reference.get("answer", "") if isinstance(reference, dict) else ""
    return 1 if candidate == expected else 0
`,
  TYPESCRIPT: `function evaluate({ output, reference }: { output?: Record<string, unknown>; reference?: Record<string, unknown> }) {
  const candidate = typeof output?.answer === "string" ? output.answer : "";
  const expected = typeof reference?.answer === "string" ? reference.answer : "";
  return candidate === expected ? 1 : 0;
}
`,
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
      .filter(Boolean)
      .filter(unique);
  }
  const firstParam = params.split(",")[0]?.trim() ?? "";
  const paramName = firstParam.split(":")[0]?.trim() ?? "";
  if (!paramName) {
    return [];
  }
  const accessPattern = new RegExp(`${paramName}\\.([a-zA-Z_$][\\w$]*)`, "g");
  const matches = sourceCode.matchAll(accessPattern);
  return Array.from(matches, (match) => match[1]).filter(unique);
}

function unique(value: string, index: number, values: string[]) {
  return values.indexOf(value) === index;
}
