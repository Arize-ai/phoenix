import { useNavigate } from "react-router";

import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/empty-state";

export function PromptsEmpty() {
  const navigate = useNavigate();

  return (
    <EmptyStateArea>
      <EmptyState
        graphic={<EmptyStateGraphic variant="prompt" />}
        description="Create and manage prompt templates for your AI applications."
        action={{
          type: "strip",
          items: [
            {
              kind: "link",
              label: "Docs",
              href: "https://arize.com/docs/phoenix/get-started/get-started-prompt-playground",
            },
            {
              kind: "button",
              variant: "primary",
              children: "Playground",
              onPress: () => navigate("/playground"),
            },
          ],
        }}
      />
    </EmptyStateArea>
  );
}
