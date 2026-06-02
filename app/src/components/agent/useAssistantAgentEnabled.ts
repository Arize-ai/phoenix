import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

// Agent UI renders only when all three gates are on: deploy env var, admin system-setting, and user preference.
export function useAssistantAgentEnabled() {
  const adminAgentEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  return (
    !window.Config.agentAssistantDisabled &&
    adminAgentEnabled &&
    isAssistantAgentEnabled
  );
}
