import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

export function useAssistantAgentEnabled() {
  const isAgentsFeatureEnabled = useFeatureFlag("agents");
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  return isAgentsFeatureEnabled && isAssistantAgentEnabled;
}
