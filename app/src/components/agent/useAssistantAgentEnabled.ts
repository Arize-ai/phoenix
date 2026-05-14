import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

/**
 * Three layered gates: deploy ceiling (env var) → admin ceiling (system_settings.agent.assistant.enabled)
 * → user preference (LocalStorage). All three must be on for the agent UI to render.
 */
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
