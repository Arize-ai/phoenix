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
}): string[] => {
  return extractCodeEvaluatorVariableDefinitions({ language, sourceCode }).map(
    ({ name }) => name
  );
};

export const extractRequiredCodeEvaluatorVariables = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}): string[] => {
  return extractCodeEvaluatorVariableDefinitions({ language, sourceCode })
    .filter(({ isRequired }) => isRequired)
    .map(({ name }) => name);
};

type CodeEvaluatorVariableDefinition = {
  name: string;
  isRequired: boolean;
};

function extractCodeEvaluatorVariableDefinitions({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}): CodeEvaluatorVariableDefinition[] {
  if (language === "PYTHON") {
    return extractPythonVariables(sourceCode);
  }
  return extractTypeScriptVariables(sourceCode);
}

function extractPythonVariables(sourceCode: string) {
  const match = sourceCode.match(/def\s+evaluate\s*\(([^)]*)\)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const isVariadic = part.startsWith("*");
      const name =
        part
          .replace(/^\*+/, "")
          .split("=")[0]
          ?.trim()
          .split(":")[0]
          ?.trim() ?? "";
      return {
        name,
        isRequired: !isVariadic && !part.includes("="),
      };
    })
    .filter(({ name }) => Boolean(name) && name !== "/")
    .filter(uniqueDefinition);
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
      .map((part) => ({
        name:
          part
            .split(":")[0]
            ?.trim()
            .split("=")[0]
            ?.trim()
            .replace(/\?$/, "")
            .trim() ?? "",
        // TypeScript evaluators receive one object, so destructured keys can
        // be absent without preventing the evaluator call.
        isRequired: false,
      }))
      .filter(({ name }) => Boolean(name))
      .filter(uniqueDefinition);
  }
  return [];
}

function uniqueDefinition(
  definition: CodeEvaluatorVariableDefinition,
  index: number,
  definitions: CodeEvaluatorVariableDefinition[]
) {
  return (
    definitions.findIndex(({ name }) => name === definition.name) === index
  );
}
