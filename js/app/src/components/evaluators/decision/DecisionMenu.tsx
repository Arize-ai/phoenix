import {
  PromptOrDecisionMenu,
  type PromptOrDecisionMenuItem,
} from "@phoenix/pages/playground/PromptOrDecisionMenu";

export type DecisionMenuItem = PromptOrDecisionMenuItem;

/**
 * Picks a saved decision, drawn like the playground's prompt menu. Joins a
 * {@link DecisionVersionSelector} in a `CompositeField` once a decision is
 * selected.
 */
export function DecisionMenu({
  decisions,
  selectedDecision,
  isDisabled,
  hasVersionSelector,
  onSelectDecision,
}: {
  decisions: readonly DecisionMenuItem[];
  /** The selected decision; it need not be in `decisions`. */
  selectedDecision: DecisionMenuItem | null;
  isDisabled?: boolean;
  hasVersionSelector: boolean;
  onSelectDecision: (decisionId: string) => void;
}) {
  return (
    <PromptOrDecisionMenu
      data-testid="decision-menu-button"
      items={decisions}
      selectedItem={selectedDecision}
      onSelect={onSelectDecision}
      isDisabled={isDisabled}
      hasVersionSelector={hasVersionSelector}
      placeholder="Select a decision"
      noItemsText="No saved decisions"
      searchLabel="Search decisions"
      noMatchesText="No decisions"
    />
  );
}
