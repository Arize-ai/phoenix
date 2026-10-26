import { useNavigate } from "react-router";

import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { useViewerCanModify } from "@phoenix/contexts";

import { usePromptsFilterContext } from "./PromptsFilterProvider";

export function PromptsEmpty() {
  const navigate = useNavigate();
  const { filter, selectedPromptLabelIds } = usePromptsFilterContext();
  const canModify = useViewerCanModify();
  const isFiltered = !!filter.trim() || selectedPromptLabelIds.length > 0;

  if (isFiltered) {
    return (
      <EmptyStateArea>
        <EmptyState
          graphic={<EmptyStateGraphic variant="search" />}
          title="No results"
          description="Try another name or clear the selected labels."
        />
      </EmptyStateArea>
    );
  }

  return (
    <EmptyStateArea>
      <EmptyState
        graphic={<EmptyStateGraphic variant="prompt" />}
        description="Create and manage prompts and decisions for your AI applications."
        action={{
          type: "strip",
          items: [
            {
              kind: "link",
              label: "Docs",
              href: "https://arize.com/docs/phoenix/get-started/get-started-prompt-playground",
            },
            ...(canModify
              ? [
                  {
                    kind: "button" as const,
                    children: "New Decision",
                    onPress: () => navigate("/playground?newDecision=true"),
                  },
                  {
                    kind: "button" as const,
                    variant: "primary" as const,
                    children: "New Prompt",
                    onPress: () => navigate("/playground"),
                  },
                ]
              : []),
          ],
        }}
      />
    </EmptyStateArea>
  );
}
