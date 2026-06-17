import { useNavigate } from "react-router";

import { Flex, View } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/empty-state";

export function PromptsEmpty() {
  const navigate = useNavigate();

  return (
    <View width="100%" paddingY="size-400">
      <Flex direction="column" width="100%" alignItems="center">
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
      </Flex>
    </View>
  );
}
