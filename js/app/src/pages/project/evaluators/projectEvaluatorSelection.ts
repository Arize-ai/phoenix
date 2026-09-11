import type { RowSelectionState } from "@tanstack/react-table";

import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export type SelectedProjectEvaluator = {
  id: string;
  name: string;
  evaluationTarget: ProjectEvaluatorTarget;
};

export type ProjectEvaluatorSelection = Record<
  string,
  SelectedProjectEvaluator
>;

export function toRowSelectionState(
  selection: ProjectEvaluatorSelection
): RowSelectionState {
  return Object.fromEntries(Object.keys(selection).map((id) => [id, true]));
}

/**
 * Reconciles TanStack's id-only selection with the metadata the compare
 * toolbar needs. Selections on unloaded pages remain intact; unchecked ids
 * are removed and newly checked rows receive metadata from the current page.
 */
export function reconcileProjectEvaluatorSelection({
  nextRowSelection,
  previousSelection,
  rowsById,
}: {
  nextRowSelection: RowSelectionState;
  previousSelection: ProjectEvaluatorSelection;
  rowsById: Record<string, SelectedProjectEvaluator>;
}): ProjectEvaluatorSelection {
  const nextSelection: ProjectEvaluatorSelection = {};
  for (const [id, isSelected] of Object.entries(nextRowSelection)) {
    if (!isSelected) {
      continue;
    }
    const evaluator = previousSelection[id] ?? rowsById[id];
    if (evaluator) {
      nextSelection[id] = evaluator;
    }
  }
  return nextSelection;
}

export function getCompareEvaluatorsDisabledReason(
  selection: ProjectEvaluatorSelection
): string | null {
  const selected = Object.values(selection);
  if (selected.length < 2) {
    return "Select two evaluators to compare";
  }
  if (selected.length > 2) {
    return "Select exactly two evaluators to compare";
  }
  if (selected[0]?.evaluationTarget !== selected[1]?.evaluationTarget) {
    return "Both evaluators must evaluate the same target (span, trace, or session)";
  }
  return null;
}
