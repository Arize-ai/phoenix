import { css } from "@emotion/react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Card,
  DocumentationHelp,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Switch,
  Text,
} from "@phoenix/components";
import {
  AgentExperimentalSettings,
  AgentObservabilitySettings,
  AgentSettingsForm,
  AgentSubagentsSettings,
  AgentWebAccessSettings,
  SystemSettingsWarning,
} from "@phoenix/components/agent";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";

import type { settingsAgentsPageLoaderQuery } from "./__generated__/settingsAgentsPageLoaderQuery.graphql";
import { SettingsAgentSessionsCard } from "./SettingsAgentSessionsCard";
import type { SettingsAgentsPageLoaderType } from "./settingsAgentsPageLoader";
import { settingsAgentsPageLoaderGql } from "./settingsAgentsPageLoader";
import { SettingsAgentsAdminSettingsSection } from "./SettingsAgentsWorkspaceCard";

/**
 * Whether the subagents (server-side bash tool) setting should be offered in the
 * UI. Hidden when the deployment sets PHOENIX_AGENTS_DISABLE_BASH, which prevents
 * subagents from being attached server-side. Does not affect the frontend bash tool.
 */
function shouldShowSubagentsSetting(agentBashDisabled: boolean): boolean {
  return !agentBashDisabled;
}

const ADMIN_SECTION_ID = "admin-settings";
const PERSONAL_SECTION_ID = "personal-settings";
const EXPERIMENTAL_SECTION_ID = "experimental-settings";

const sectionPanelCSS = css`
  padding: var(--global-dimension-size-200);
`;

const settingsListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  list-style: none;
  margin: 0;
  padding: 0;
`;

const settingRowCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-primary);
`;

const settingSwitchCSS = css`
  width: 100%;
  box-sizing: border-box;
  white-space: normal;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--global-dimension-size-150);
  gap: var(--global-dimension-size-200);

  .assistant-personal-settings__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

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
    <li css={settingRowCSS}>
      <Switch
        labelPlacement="start"
        isSelected={adminAssistantEnabled && isAssistantAgentEnabled}
        isDisabled={!adminAssistantEnabled}
        onChange={setIsAssistantAgentEnabled}
        css={settingSwitchCSS}
      >
        <span className="assistant-personal-settings__label">
          <Text weight="heavy">Use assistant</Text>
          <Text color="text-500" size="S">
            Shows the assistant in this browser.
          </Text>
        </span>
      </Switch>
      {!adminAssistantEnabled ? (
        <SystemSettingsWarning isAdmin={isAdmin} isOnSettingsPage />
      ) : null}
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
    <li css={settingRowCSS}>
      <Switch
        labelPlacement="start"
        isSelected={fabMode === "floating"}
        isDisabled={!adminAssistantEnabled || !isAssistantAgentEnabled}
        onChange={(isFloating) =>
          setFabMode(isFloating ? "floating" : "pinned")
        }
        css={settingSwitchCSS}
      >
        <span className="assistant-personal-settings__label">
          <Text weight="heavy">Floating assistant button</Text>
          <Text color="text-500" size="S">
            Shows the assistant as a draggable floating button instead of
            pinning it to the top navigation bar.
          </Text>
        </span>
      </Switch>
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
    <li css={settingRowCSS}>
      <Switch
        labelPlacement="start"
        isSelected={defaultTemporaryChat}
        isDisabled={!adminAssistantEnabled || !isAssistantAgentEnabled}
        onChange={setDefaultTemporaryChat}
        css={settingSwitchCSS}
      >
        <span className="assistant-personal-settings__label">
          <Text weight="heavy">Start new chats as temporary</Text>
          <Text color="text-500" size="S">
            New chats default to temporary mode and are not saved to your
            history. You can still toggle each chat before sending its first
            message.
          </Text>
        </span>
      </Switch>
    </li>
  );
}

function AssistantDisplaySettings() {
  return (
    <ul css={settingsListCSS}>
      <AssistantAgentEnabledSetting />
      <AssistantFabModeSetting />
      <AssistantTemporaryChatSetting />
    </ul>
  );
}

function AssistantSettingsSectionTrigger({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DisclosureTrigger direction="column" alignItems="start">
      <Text weight="heavy" size="S">
        {title}
      </Text>
      <Text color="text-500" size="XS">
        {description}
      </Text>
    </DisclosureTrigger>
  );
}

function PersonalSettingsSection() {
  return (
    <Flex direction="column" gap="size-200">
      <Text color="text-500">
        These settings apply only to this browser. System settings control which
        options are available.
      </Text>
      <AssistantDisplaySettings />
      <AgentSettingsForm>
        <AgentWebAccessSettings />
        {shouldShowSubagentsSetting(window.Config.agentBashDisabled) ? (
          <AgentSubagentsSettings />
        ) : null}
        <AgentObservabilitySettings isOnSettingsPage />
      </AgentSettingsForm>
    </Flex>
  );
}

export function SettingsAgentsPage() {
  const loaderData = useLoaderData<SettingsAgentsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = useOwnedPreloadedQuery<settingsAgentsPageLoaderQuery>({
    query: settingsAgentsPageLoaderGql,
    queryRef: loaderData,
  });
  const isAdmin = useIsAdminOrAuthDisabled();
  const isExperimentalSettingsEnabled = useFeatureFlag(
    "agent-experimental-settings"
  );
  return (
    <Flex direction="column" gap="size-200">
      <Card
        title="Assistant settings - PXI"
        titleExtra={
          <DocumentationHelp topic="pxi">
            Configure Phoenix Intelligence and personal assistant preferences.
          </DocumentationHelp>
        }
      >
        <DisclosureGroup defaultExpandedKeys={[PERSONAL_SECTION_ID]}>
          {isAdmin ? (
            <Disclosure id={ADMIN_SECTION_ID}>
              <AssistantSettingsSectionTrigger
                title="System settings"
                description="Settings that apply to everyone using this Phoenix instance."
              />
              <DisclosurePanel>
                <div css={sectionPanelCSS}>
                  <SettingsAgentsAdminSettingsSection />
                </div>
              </DisclosurePanel>
            </Disclosure>
          ) : null}
          <Disclosure id={PERSONAL_SECTION_ID}>
            <AssistantSettingsSectionTrigger
              title="Personal settings"
              description="Your assistant preferences for this browser."
            />
            <DisclosurePanel>
              <div css={sectionPanelCSS}>
                <PersonalSettingsSection />
              </div>
            </DisclosurePanel>
          </Disclosure>
          {isExperimentalSettingsEnabled ? (
            <Disclosure id={EXPERIMENTAL_SECTION_ID}>
              <AssistantSettingsSectionTrigger
                title="Experimental settings"
                description="Early assistant capabilities that may change."
              />
              <DisclosurePanel>
                <div css={sectionPanelCSS}>
                  <AgentExperimentalSettings />
                </div>
              </DisclosurePanel>
            </Disclosure>
          ) : null}
        </DisclosureGroup>
      </Card>
      <SettingsAgentSessionsCard query={query} />
    </Flex>
  );
}
