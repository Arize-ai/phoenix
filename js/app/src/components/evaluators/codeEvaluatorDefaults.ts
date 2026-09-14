import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSourceGrain,
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
 * `EvaluatorParams` to annotate against — so the project grains open on the
 * three names they are actually handed, unannotated.
 *
 * Kept apart from the CodeMirror-backed utilities so state modules can build
 * a draft without pulling the editor into their import graph.
 */
export function getDefaultCodeEvaluatorSource(
  language: CodeEvaluatorLanguage,
  grain: EvaluatorMappingSourceGrain
): string {
  const isDataset = grain === "dataset";
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
