import type {
  CodeEvaluatorLanguage,
  EvaluatorRecordKind,
} from "@phoenix/types";

const PYTHON_INDENT = "    ";

const TYPESCRIPT_INDENT = "  ";

/**
 * Returns the default placeholder source code for a new code evaluator.
 * The placeholder shows the full `{score, label, explanation}` return
 * shape alongside the bare shorthands (number → score, string → label).
 *
 * A dataset example carries a `reference` beside the three every evaluator
 * receives; a span or a session does not, and its footer declares no
 * `EvaluatorParams` to annotate against — so the project record kinds open on
 * the three names they are actually handed, unannotated.
 *
 * Kept apart from the CodeMirror-backed utilities so state modules can build
 * a draft without pulling the editor into their import graph.
 */
export function getDefaultCodeEvaluatorSource(
  language: CodeEvaluatorLanguage,
  recordKind: EvaluatorRecordKind
): string {
  const isDataset = recordKind === "dataset";

  if (language === "PYTHON") {
    const parameters = isDataset
      ? "output, reference=None, input=None, metadata=None"
      : "input=None, output=None, metadata=None";

    return `def evaluate(${parameters}):
${PYTHON_INDENT}# return 1.0     # numbers are recorded as scores
${PYTHON_INDENT}# return "pass"  # strings are recorded as labels
${PYTHON_INDENT}return {"score": 1.0, "label": "pass", "explanation": "..."}
`;
  }

  // TYPESCRIPT
  const signature = isDataset
    ? "{ output, reference, input, metadata }: EvaluatorParams"
    : "{ input, output, metadata }";

  return `function evaluate(${signature}) {
${TYPESCRIPT_INDENT}// return 1;        // numbers are recorded as scores
${TYPESCRIPT_INDENT}// return "pass";   // strings are recorded as labels
${TYPESCRIPT_INDENT}return { score: 1, label: "pass", explanation: "..." };
}
`;
}

/**
 * Code a code evaluator's Reset can go back to instead of the default: the
 * saved code of an existing evaluator, or the code a new one was copied from.
 */
export type CodeEvaluatorResetSource = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  kind: "saved" | "copied";
};

/**
 * What Reset restores, and how its tooltip says so. The given source wins
 * while the editor is still in its language; otherwise, as for a new
 * evaluator, it is the language's default.
 */
export function getCodeEvaluatorResetTarget({
  language,
  recordKind,
  resetSource,
}: {
  language: CodeEvaluatorLanguage;
  recordKind: EvaluatorRecordKind;
  resetSource?: CodeEvaluatorResetSource | null;
}): { sourceCode: string; description: string } {
  if (resetSource != null && resetSource.language === language) {
    return {
      sourceCode: resetSource.sourceCode,
      description: `Restore the ${resetSource.kind} code`,
    };
  }

  return {
    sourceCode: getDefaultCodeEvaluatorSource(language, recordKind),
    description: "Reset to the default code",
  };
}
