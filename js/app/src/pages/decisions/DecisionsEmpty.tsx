import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { useViewerCanModify } from "@phoenix/contexts";

import { useDecisionsFilterContext } from "./DecisionsFilterProvider";
export function DecisionsEmpty() {
  const { filter, selectedDecisionLabelIds } = useDecisionsFilterContext();
  const isFiltered = !!filter.trim() || selectedDecisionLabelIds.length > 0;
  const canModify = useViewerCanModify();
  return (
    <EmptyStateArea>
      <EmptyState
        graphic={
          <EmptyStateGraphic variant={isFiltered ? "search" : "decision"} />
        }
        title={isFiltered ? "No results" : "No decisions"}
        description={
          isFiltered
            ? "Try another name or clear the selected labels."
            : "Create and manage versioned decisions for your AI applications."
        }
        action={
          !isFiltered && canModify
            ? {
                type: "strip",
                items: [
                  {
                    kind: "internal-link",
                    to: "/playground?newDecision=true",
                    children: "Playground",
                    variant: "primary",
                  },
                ],
              }
            : undefined
        }
      />
    </EmptyStateArea>
  );
}
