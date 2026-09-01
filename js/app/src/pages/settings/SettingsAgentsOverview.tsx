import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Link as RouterLink, useSearchParams } from "react-router";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import { getEditPermissionLabel } from "@phoenix/components/agent/AgentEditPermissionMenu";
import { SETTINGS_AGENTS_TAB_PARAM } from "@phoenix/constants/searchParams";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import {
  getEffectiveAttachUserId,
  getEffectiveTraceRecordingSettings,
  GITHUB_PAT_CREDENTIAL_KEY,
} from "@phoenix/store/agentStore";

import {
  isServerAgentRuntimeEnabled,
  SettingsAgentsSection,
  type SettingsAgentsTabId,
} from "./SettingsAgentsShared";

const atAGlanceListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-150);

  .at-a-glance__card {
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

function AtAGlanceCard({
  tabId,
  label,
  icon,
  summary,
}: {
  tabId: SettingsAgentsTabId;
  label: string;
  icon: ReactNode;
  summary: string;
}) {
  const [searchParams] = useSearchParams();
  // Preserve unrelated search params so the card links stay additive.
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set(SETTINGS_AGENTS_TAB_PARAM, tabId);
  return (
    <li>
      <RouterLink
        className="at-a-glance__card"
        to={{ search: nextParams.toString() }}
        replace
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
 * Summary grid on the General tab: one card per settings area showing that
 * area's current state; selecting a card jumps to its tab.
 */
export function SettingsAgentsAtAGlance() {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const capabilities = useAgentContext((state) => state.capabilities);
  const editPermissionMode = useAgentContext(
    (state) => state.permissions.edits
  );

  const isSubagentsAvailable = isServerAgentRuntimeEnabled(
    window.Config.agentBashDisabled
  );
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
    <SettingsAgentsSection
      title="At a glance"
      description="The current state of each settings area. Select a card to jump to it."
    >
      <ul css={atAGlanceListCSS}>
        <AtAGlanceCard
          tabId="tools"
          label="Tools"
          icon={<Icons.Wrench />}
          summary={toolsSummary}
        />
        <AtAGlanceCard
          tabId="permissions"
          label="Permissions"
          icon={<Icons.Shield />}
          summary={permissionsSummary}
        />
        <AtAGlanceCard
          tabId="tracing"
          label="Tracing & privacy"
          icon={<Icons.Trace />}
          summary={tracingSummary}
        />
        <AtAGlanceCard
          tabId="chats"
          label="Chats & data"
          icon={<Icons.Database />}
          summary={chatsSummary}
        />
      </ul>
    </SettingsAgentsSection>
  );
}
