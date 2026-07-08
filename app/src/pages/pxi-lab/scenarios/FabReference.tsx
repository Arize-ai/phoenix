import { Flex } from "@phoenix/components";
import { AgentChatWidgetButton } from "@phoenix/components/agent/AgentChatWidget";

import type { PxiScenario } from "./types";

const scenario: PxiScenario = {
  title: "PXI FAB — reference (resting · thinking)",
  Component: function FabReference() {
    return (
      <Flex direction="row" gap="size-400" alignItems="center">
        <AgentChatWidgetButton isStreaming={false} />
        <AgentChatWidgetButton isStreaming />
      </Flex>
    );
  },
};

export default scenario;
