import { Card, Switch, View } from "@phoenix/components";
import { AgentSettingsForm } from "@phoenix/components/agent";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

function AssistantAgentEnabledSwitch() {
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  const setIsAssistantAgentEnabled = usePreferencesContext(
    (state) => state.setIsAssistantAgentEnabled
  );
  return (
    <Switch
      labelPlacement="start"
      isSelected={isAssistantAgentEnabled}
      onChange={setIsAssistantAgentEnabled}
    >
      Enabled
    </Switch>
  );
}

export function SettingsAgentsPage() {
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  return (
    <Card
      title="Assistant"
      collapsible
      defaultOpen={isAssistantAgentEnabled}
      extra={<AssistantAgentEnabledSwitch />}
    >
      <View padding="size-200">
        <AgentSettingsForm />
      </View>
    </Card>
  );
}
