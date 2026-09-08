import { Alert, Flex, Text } from "@phoenix/components";
import { SystemSettingsWarning } from "@phoenix/components/agent";
import { isAgentCuratedModelSelection } from "@phoenix/components/agent/agentCuratedModels";
import { AgentModelMenu } from "@phoenix/components/agent/AgentModelMenu";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";

import { SettingsAgentsOverview } from "./SettingsAgentsOverview";
import {
  SettingsAgentsSection,
  SettingsFieldRow,
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
} from "./SettingsAgentsShared";

function AssistantAgentEnabledSetting() {
  const isAdmin = useIsAdminOrAuthDisabled();
  const adminAssistantEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  const setIsAssistantAgentEnabled = usePreferencesContext(
    (state) => state.setIsAssistantAgentEnabled
  );
  return (
    <li>
      <SettingsSwitchRow
        title="Use assistant"
        description="Shows the assistant in this browser."
        isSelected={adminAssistantEnabled && isAssistantAgentEnabled}
        isDisabled={!adminAssistantEnabled}
        onChange={setIsAssistantAgentEnabled}
      />
      {!adminAssistantEnabled ? (
        <SystemSettingsWarning
          isAdmin={isAdmin}
          // The controlling "Assistant access" switch lives on another tab, so
          // the default "system settings above" copy would misdirect admins.
          adminMessage="Disabled by system settings. You can enable it for all users under the Permissions tab."
        />
      ) : null}
    </li>
  );
}

function AssistantModelSetting() {
  const store = useAgentStore();
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  const selectedModel: ModelMenuValue = {
    provider: defaultModelConfig.provider,
    modelName: defaultModelConfig.modelName ?? "",
    ...(defaultModelConfig.customProvider && {
      customProvider: defaultModelConfig.customProvider,
    }),
  };
  const isRecommendedModel = isAgentCuratedModelSelection(selectedModel);
  const handleModelChange = (model: ModelMenuValue) => {
    const { defaultModelConfig: current } = store.getState();
    setDefaultModelConfig({
      ...current,
      provider: model.provider,
      modelName: model.modelName,
      customProvider: model.customProvider ?? null,
    });
  };
  return (
    <li>
      <SettingsFieldRow
        title="Model"
        description="The default model for new chats. Providers and credentials are managed in AI Providers."
        control={
          <AgentModelMenu
            value={selectedModel}
            onChange={handleModelChange}
            limitToCuratedModels={false}
          />
        }
      >
        {!isRecommendedModel ? (
          <Alert variant="warning">
            This model has not been verified with the assistant and may fail or
            behave poorly.
          </Alert>
        ) : null}
      </SettingsFieldRow>
    </li>
  );
}

function AssistantFabModeSetting() {
  const adminAssistantEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  const fabMode = useAgentContext((state) => state.fabMode);
  const setFabMode = useAgentContext((state) => state.setFabMode);
  return (
    <li>
      <SettingsSwitchRow
        title="Floating assistant button"
        description="Shows the assistant as a draggable floating button instead of pinning it to the top navigation bar."
        isSelected={fabMode === "floating"}
        isDisabled={!adminAssistantEnabled || !isAssistantAgentEnabled}
        onChange={(isFloating) =>
          setFabMode(isFloating ? "floating" : "pinned")
        }
      />
    </li>
  );
}

function AssistantTemporaryChatSetting() {
  const adminAssistantEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );
  const isAssistantAgentEnabled = usePreferencesContext(
    (state) => state.isAssistantAgentEnabled
  );
  const defaultTemporaryChat = useAgentContext(
    (state) => state.defaultTemporaryChat
  );
  const setDefaultTemporaryChat = useAgentContext(
    (state) => state.setDefaultTemporaryChat
  );
  return (
    <li>
      <SettingsSwitchRow
        title="Start new chats as temporary"
        description="New chats default to temporary mode and are not saved to your history. You can still toggle each chat before sending its first message."
        isSelected={defaultTemporaryChat}
        isDisabled={!adminAssistantEnabled || !isAssistantAgentEnabled}
        onChange={setDefaultTemporaryChat}
      />
    </li>
  );
}

/**
 * General tab: the settings overview plus how the assistant shows in this
 * browser and which model it uses.
 */
export function SettingsAgentsGeneralTab() {
  const isAdmin = useIsAdminOrAuthDisabled();
  return (
    <Flex direction="column" gap="size-300">
      <Text color="text-500" size="XS">
        Personal settings apply only to this browser.
        {isAdmin ? (
          <>
            {" "}
            Settings marked <SystemBadge /> apply to everyone using this Phoenix
            instance and can be changed only by admins.
          </>
        ) : (
          " System settings control which options are available."
        )}
      </Text>
      <SettingsAgentsOverview />
      <SettingsAgentsSection
        title="Assistant"
        description="Where and how the assistant appears in this browser."
      >
        <ul css={settingsRowsCSS}>
          <AssistantAgentEnabledSetting />
          <AssistantModelSetting />
          <AssistantFabModeSetting />
          <AssistantTemporaryChatSetting />
        </ul>
      </SettingsAgentsSection>
    </Flex>
  );
}
