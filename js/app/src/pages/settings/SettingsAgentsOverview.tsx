import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import { getEditPermissionLabel } from "@phoenix/components/agent/AgentEditPermissionMenu";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import {
  getEffectiveAttachUserId,
  getEffectiveTraceRecordingSettings,
  GITHUB_PAT_CREDENTIAL_KEY,
} from "@phoenix/store/agentStore";

import {
  isServerAgentRuntimeEnabled,
  SETTINGS_AGENTS_TABS,
  SettingsAgentsSection,
  type SettingsAgentsTabId,
  settingsAgentsTabPath,
} from "./SettingsAgentsShared";

const overviewListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-150);

  .assistant-overview__card {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    box-sizing: border-box;
    height: 100%;
    padding: var(--global-dimension-size-150);
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    background: var(--global-background-color-primary);
    color: inherit;
    text-decoration: none;

    &:hover {
      border-color: var(--global-border-color-hover);
    }

    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
`;

function onOff(isOn: boolean): string {
  return isOn ? "on" : "off";
}

function OverviewCard({
  tabId,
  icon,
  summary,
}: {
  tabId: SettingsAgentsTabId;
  icon: ReactNode;
  summary: string;
}) {
  const label =
    SETTINGS_AGENTS_TABS.find((tab) => tab.id === tabId)?.label ?? tabId;
  return (
    <li>
      <RouterLink
        className="assistant-overview__card"
        to={settingsAgentsTabPath(tabId)}
        aria-label={`Go to ${label} settings`}
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-100"
        >
          <Flex direction="row" alignItems="center" gap="size-100">
            <Icon svg={icon} />
            <Text weight="heavy" size="S">
              {label}
            </Text>
          </Flex>
          <Icon svg={<Icons.ChevronRight />} />
        </Flex>
        <Text color="text-500" size="XS">
          {summary}
        </Text>
      </RouterLink>
    </li>
  );
}

/**
 * Overview grid on the General tab: one card per settings area showing that
 * area's current state; selecting a card goes to its tab.
 */
export function SettingsAgentsOverview() {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const capabilities = useAgentContext((state) => state.capabilities);
  const editPermissionMode = useAgentContext(
    (state) => state.permissions.edits
  );

  const isSubagentsAvailable = isServerAgentRuntimeEnabled();
  const isWebSearchOn =
    agentsConfig.webAccessEnabled && capabilities["web.access"];
  const hasPersonalGithubToken = useAgentContext((state) =>
    Boolean(state.integrationCredentials[GITHUB_PAT_CREDENTIAL_KEY])
  );
  const githubSummary = !agentsConfig.githubEnabled
    ? "GitHub tools off"
    : hasPersonalGithubToken
      ? "GitHub token saved"
      : "No GitHub token";
  const toolsSummary = [
    `Web search ${onOff(isWebSearchOn)}`,
    ...(isSubagentsAvailable
      ? [`Subagents ${onOff(capabilities["subagents.enabled"])}`]
      : []),
    ...(agentsConfig.githubServerEnabled ? [githubSummary] : []),
  ].join(" · ");

  const permissionsSummary = [
    `Assistant access ${onOff(agentsConfig.assistantEnabled)}`,
    `Edits: ${getEditPermissionLabel(editPermissionMode).toLocaleLowerCase()}`,
  ].join(" · ");

  const effectiveRecording = getEffectiveTraceRecordingSettings({
    agentsConfig,
    observability,
  });
  const effectiveAttachUserId = getEffectiveAttachUserId({
    agentsConfig,
    observability,
  });
  const isRemoteCollectorConfigured = Boolean(agentsConfig.collectorEndpoint);
  const tracingSummary = [
    `Saving traces ${onOff(effectiveRecording.ingestTraces)}`,
    ...(isRemoteCollectorConfigured
      ? [`Export ${onOff(effectiveRecording.exportRemoteTraces)}`]
      : []),
    effectiveAttachUserId
      ? "Email attached to traces"
      : "Email not attached to traces",
  ].join(" · ");

  const { sessionRetentionMaxIdleDays, sessionRetentionMaxCountPerUser } =
    agentsConfig;
  const chatsSummary = [
    sessionRetentionMaxIdleDays !== null
      ? `Idle chats deleted after ${sessionRetentionMaxIdleDays} days`
      : "Idle chats kept indefinitely",
    sessionRetentionMaxCountPerUser !== null
      ? `${sessionRetentionMaxCountPerUser}-chat limit per user`
      : "No saved-chat limit",
  ].join(" · ");

  return (
    <SettingsAgentsSection title="Overview">
      <ul css={overviewListCSS}>
        <OverviewCard
          tabId="tools"
          icon={<Icons.Wrench />}
          summary={toolsSummary}
        />
        <OverviewCard
          tabId="permissions"
          icon={<Icons.Shield />}
          summary={permissionsSummary}
        />
        <OverviewCard
          tabId="tracing"
          icon={<Icons.Trace />}
          summary={tracingSummary}
        />
        <OverviewCard
          tabId="chats"
          icon={<Icons.Database />}
          summary={chatsSummary}
        />
      </ul>
    </SettingsAgentsSection>
  );
}
