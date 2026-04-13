import { Card, View } from "@phoenix/components";
import { AgentSettingsForm } from "@phoenix/components/agent";

export function SettingsAgentsPage() {
  return (
    <Card title="Assistant" collapsible>
      <View padding="size-200">
        <AgentSettingsForm />
      </View>
    </Card>
  );
}
