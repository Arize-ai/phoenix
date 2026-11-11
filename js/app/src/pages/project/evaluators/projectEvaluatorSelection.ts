import type { RowSelectionState } from "@tanstack/react-table";

import type { EvaluatorToDelete } from "@phoenix/components/evaluators/deleteEvaluatorsCopy";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorKind } from "@phoenix/types";

/**
 * What the selection toolbar needs to know about a selected evaluator: its
 * target to compare it, and its name and kind to delete it.
 */
export type SelectedProjectEvaluator = {
  evaluationTarget: ProjectEvaluatorTarget;
  name: string;
  kind: EvaluatorKind;
};

export type ProjectEvaluatorSelection = Partial<
  Record<string, SelectedProjectEvaluator>
>;

export function toRowSelectionState(
  selection: ProjectEvaluatorSelection
): RowSelectionState {
  return Object.fromEntries(Object.keys(selection).map((id) => [id, true]));
}

/**
 * Reconciles TanStack's id-only selection with the evaluator details the
 * selection toolbar needs. Selections on unloaded pages remain intact; unchecked
 * ids are removed and newly checked rows receive details from the current page.
 */
export function reconcileProjectEvaluatorSelection({
  nextRowSelection,
  previousSelection,
  evaluatorsById,
}: {
  nextRowSelection: RowSelectionState;
  previousSelection: ProjectEvaluatorSelection;
  evaluatorsById: ProjectEvaluatorSelection;
}): ProjectEvaluatorSelection {
  const nextSelection: ProjectEvaluatorSelection = {};
  for (const [id, isSelected] of Object.entries(nextRowSelection)) {
    if (!isSelected) {
      continue;
    }
    const evaluator = previousSelection[id] ?? evaluatorsById[id];
    if (evaluator) {
      nextSelection[id] = evaluator;
    }
  }
  return nextSelection;
}

export function getCompareEvaluatorsDisabledReason(
  selection: ProjectEvaluatorSelection
): string | null {
  const selectedTargets = Object.values(selection).map(
    (evaluator) => evaluator?.evaluationTarget
  );
  if (selectedTargets.length < 2) {
    return "Select two evaluators to compare";
  }
  if (selectedTargets.length > 2) {
    return "Select exactly two evaluators to compare";
  }
  if (selectedTargets[0] !== selectedTargets[1]) {
    return "Both evaluators must evaluate the same target (span, trace, or session)";
  }
  return null;
}

/**
 * The selected evaluators that the table has loaded, in selection order, for
 * deleting them. Rows hidden by a search, or no longer returned after a
 * delete, are left out.
 */
export function getSelectedProjectEvaluators({
  selection,
  evaluatorsById,
}: {
  selection: ProjectEvaluatorSelection;
  evaluatorsById: ProjectEvaluatorSelection;
}): EvaluatorToDelete[] {
  return Object.keys(selection).flatMap((id) => {
    const evaluator = evaluatorsById[id];
    return evaluator
      ? [{ id, name: evaluator.name, kind: evaluator.kind }]
      : [];
  });
}
