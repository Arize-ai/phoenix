import { css } from "@emotion/react";
import type { Key } from "react-aria-components";
import { useLoaderData, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import {
  DocumentationHelp,
  Flex,
  Heading,
  LazyTabPanel,
  Tab,
  TabList,
  Tabs,
  Text,
} from "@phoenix/components";
import {
  AgentSettingsForm,
  SystemSettingsWarning,
} from "@phoenix/components/agent";
import { SETTINGS_AGENTS_TAB_PARAM } from "@phoenix/constants/searchParams";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";

import type { settingsAgentsPageLoaderQuery } from "./__generated__/settingsAgentsPageLoaderQuery.graphql";
import { SettingsAgentsAtAGlance } from "./SettingsAgentsAtAGlance";
import { SettingsAgentsChatsTab } from "./SettingsAgentsChatsTab";
import type { SettingsAgentsPageLoaderType } from "./settingsAgentsPageLoader";
import { settingsAgentsPageLoaderGql } from "./settingsAgentsPageLoader";
import { SettingsAgentsPermissionsTab } from "./SettingsAgentsPermissionsTab";
import {
  isSettingsAgentsTabId,
  SETTINGS_AGENTS_TABS,
  SettingsAgentsSection,
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
} from "./SettingsAgentsShared";
import { SettingsAgentsToolsTab } from "./SettingsAgentsToolsTab";
import { SettingsAgentsTracingTab } from "./SettingsAgentsTracingTab";

const DEFAULT_TAB = "general";

const pageCSS = css`
  max-width: 900px;
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
    <li>
      <SettingsSwitchRow
        title="Use assistant"
        description="Shows the assistant in this browser."
        isSelected={adminAssistantEnabled && isAssistantAgentEnabled}
        isDisabled={!adminAssistantEnabled}
        onChange={setIsAssistantAgentEnabled}
      />
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

function SettingsAgentsGeneralTab() {
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
      <SettingsAgentsAtAGlance />
      <SettingsAgentsSection
        title="Assistant"
        description="Where and how the assistant shows up in this browser."
      >
        <ul css={settingsRowsCSS}>
          <AssistantAgentEnabledSetting />
          <AssistantFabModeSetting />
          <AssistantTemporaryChatSetting />
        </ul>
      </SettingsAgentsSection>
      <SettingsAgentsSection
        title="Model"
        description="The default model for new chats. Providers and credentials are managed in AI Providers."
      >
        <AgentSettingsForm />
      </SettingsAgentsSection>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get(SETTINGS_AGENTS_TAB_PARAM);
  const selectedTab = isSettingsAgentsTabId(tabParam) ? tabParam : DEFAULT_TAB;
  const onSelectionChange = (key: Key) => {
    if (
      typeof key !== "string" ||
      !isSettingsAgentsTabId(key) ||
      key === selectedTab
    ) {
      return;
    }
    setSearchParams(
      (params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.set(SETTINGS_AGENTS_TAB_PARAM, key);
        return nextParams;
      },
      { replace: true }
    );
  };
  return (
    <div css={pageCSS}>
      <Flex direction="column" gap="size-200">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Heading level={2} weight="heavy">
            Assistant settings - PXI
          </Heading>
          <DocumentationHelp topic="pxi">
            Configure Phoenix Intelligence and personal assistant preferences.
          </DocumentationHelp>
        </Flex>
        <Tabs selectedKey={selectedTab} onSelectionChange={onSelectionChange}>
          <TabList aria-label="Assistant settings">
            {SETTINGS_AGENTS_TABS.map((tab) => (
              <Tab key={tab.id} id={tab.id}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
          <LazyTabPanel id="general" padded>
            <SettingsAgentsGeneralTab />
          </LazyTabPanel>
          <LazyTabPanel id="tools" padded>
            <SettingsAgentsToolsTab />
          </LazyTabPanel>
          <LazyTabPanel id="permissions" padded>
            <SettingsAgentsPermissionsTab />
          </LazyTabPanel>
          <LazyTabPanel id="tracing" padded>
            <SettingsAgentsTracingTab />
          </LazyTabPanel>
          <LazyTabPanel id="chats" padded>
            <SettingsAgentsChatsTab query={query} />
          </LazyTabPanel>
        </Tabs>
      </Flex>
    </div>
  );
}
