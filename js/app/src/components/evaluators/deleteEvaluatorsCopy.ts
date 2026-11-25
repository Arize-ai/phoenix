import type { EvaluatorKind } from "@phoenix/types";

/**
 * An evaluator the user is about to delete.
 */
export type EvaluatorToDelete = {
  id: string;
  name: string;
  kind: EvaluatorKind;
};

/**
 * The "delete associated …" checkbox label, or null when no selected
 * evaluator has a prompt or decision to delete.
 */
export function getDeleteAssociatedLabel(
  evaluators: ReadonlyArray<Pick<EvaluatorToDelete, "kind">>
): string | null {
  const promptCount = evaluators.filter(({ kind }) => kind === "LLM").length;
  const decisionCount = evaluators.filter(
    ({ kind }) => kind === "DECISION"
  ).length;
  const parts: string[] = [];
  if (promptCount > 0) {
    parts.push(promptCount === 1 ? "prompt" : "prompts");
  }
  if (decisionCount > 0) {
    parts.push(decisionCount === 1 ? "decision" : "decisions");
  }
  return parts.length > 0 ? `Delete associated ${parts.join(" and ")}` : null;
}

/**
 * The copy of the delete-evaluators confirmation dialog and its success
 * notification.
 */
export function getDeleteEvaluatorsCopy(
  evaluators: ReadonlyArray<Pick<EvaluatorToDelete, "name">>
) {
  const count = evaluators.length;
  if (count === 1) {
    const [{ name }] = evaluators;
    return {
      title: "Delete evaluator",
      confirmLabel: "Delete evaluator",
      description: `Are you sure you want to delete evaluator ${name}? This will also delete its evaluation traces, and it cannot be undone.`,
      successTitle: "Evaluator deleted",
      successMessage: `Evaluator ${name} has been deleted.`,
    };
  }
  return {
    title: `Delete ${count} evaluators`,
    confirmLabel: `Delete ${count} evaluators`,
    description: `Are you sure you want to delete ${count} evaluators? This will also delete their evaluation traces, and it cannot be undone.`,
    successTitle: "Evaluators deleted",
    successMessage: `${count} evaluators have been deleted.`,
  };
}
