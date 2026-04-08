import { Card } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

export function SettingsAgentsPage() {
  return <AssistantCard />;
}

function AssistantCard() {
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  return (
    <Card title="Assistant" collapsible>
      assistant card
    </Card>
  );
}
