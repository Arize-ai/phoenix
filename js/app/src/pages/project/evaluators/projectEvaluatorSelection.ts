import type { RowSelectionState } from "@tanstack/react-table";

import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export type ProjectEvaluatorSelection = Partial<
  Record<string, ProjectEvaluatorTarget>
>;

export function toRowSelectionState(
  selection: ProjectEvaluatorSelection
): RowSelectionState {
  return Object.fromEntries(Object.keys(selection).map((id) => [id, true]));
}

/**
 * Reconciles TanStack's id-only selection with the evaluation targets the
 * compare toolbar needs. Selections on unloaded pages remain intact; unchecked
 * ids are removed and newly checked rows receive targets from the current page.
 */
export function reconcileProjectEvaluatorSelection({
  nextRowSelection,
  previousSelection,
  targetsById,
}: {
  nextRowSelection: RowSelectionState;
  previousSelection: ProjectEvaluatorSelection;
  targetsById: Partial<Record<string, ProjectEvaluatorTarget>>;
}): ProjectEvaluatorSelection {
  const nextSelection: ProjectEvaluatorSelection = {};
  for (const [id, isSelected] of Object.entries(nextRowSelection)) {
    if (!isSelected) {
      continue;
    }
    const evaluationTarget = previousSelection[id] ?? targetsById[id];
    if (evaluationTarget) {
      nextSelection[id] = evaluationTarget;
    }
  }
  return nextSelection;
}

export function getCompareEvaluatorsDisabledReason(
  selection: ProjectEvaluatorSelection
): string | null {
  const selectedTargets = Object.values(selection);
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
