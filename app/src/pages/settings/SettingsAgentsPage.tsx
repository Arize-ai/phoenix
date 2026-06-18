import { css } from "@emotion/react";

import {
  Card,
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
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { shouldShowSubagentsSetting } from "./agentSettingsUtils";
import { SettingsAgentsAdminSettingsSection } from "./SettingsAgentsWorkspaceCard";

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

function useIsAdmin() {
  const { viewer } = useViewer();
  // Match IsAdminIfAuthEnabled server-side: no viewer => auth disabled => treat as admin
  return !viewer || viewer.role?.name === "ADMIN";
}

function AssistantAgentEnabledSetting() {
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
    <ul css={settingsListCSS}>
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
        {!adminAssistantEnabled ? <SystemSettingsWarning /> : null}
      </li>
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
      <AssistantAgentEnabledSetting />
      <AgentSettingsForm>
        <AgentWebAccessSettings />
        {shouldShowSubagentsSetting(window.Config.agentsBashDisabled) ? (
          <AgentSubagentsSettings />
        ) : null}
        <AgentObservabilitySettings />
      </AgentSettingsForm>
    </Flex>
  );
}

export function SettingsAgentsPage() {
  const isAdmin = useIsAdmin();
  const isExperimentalSettingsEnabled = useFeatureFlag(
    "agent-experimental-settings"
  );
  return (
    <Flex direction="column" gap="size-200">
      <Card title="Assistant settings - PXI">
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
    </Flex>
  );
}
