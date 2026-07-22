import { css } from "@emotion/react";
import { graphql, useMutation } from "react-relay";

import { Flex, Switch, Text } from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import type { SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation.graphql";
import type { SettingsAgentsWorkspaceCardSetTraceRecordingMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetTraceRecordingMutation.graphql";

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

  .assistant-admin-settings__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

export function SettingsAgentsAdminSettingsSection() {
  const { viewer } = useViewer();
  // Match IsAdminIfAuthEnabled server-side: no viewer => auth disabled => treat as admin
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";

  const isRemoteCollectorConfigured = useAgentContext((state) =>
    Boolean(state.agentsConfig.collectorEndpoint)
  );
  const assistantEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );
  const allowLocalTraces = useAgentContext(
    (state) => state.agentsConfig.allowLocalTraces
  );
  const allowRemoteExport = useAgentContext(
    (state) => state.agentsConfig.allowRemoteExport
  );
  const forceTracing = useAgentContext(
    (state) => state.agentsConfig.forceTracing
  );
  const store = useAgentStore();

  const [setAgentAssistantEnabled, isUpdatingEnabled] =
    useMutation<SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation>(graphql`
      mutation SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation(
        $input: SetAgentAssistantEnabledInput!
      ) {
        setAgentAssistantEnabled(input: $input) {
          enabled
        }
      }
    `);

  const [setTraceRecording, isUpdatingTraceRecording] =
    useMutation<SettingsAgentsWorkspaceCardSetTraceRecordingMutation>(graphql`
      mutation SettingsAgentsWorkspaceCardSetTraceRecordingMutation(
        $input: SetAgentTraceRecordingInput!
      ) {
        setAgentTraceRecording(input: $input) {
          allowLocalTraces
          allowRemoteExport
        }
      }
    `);

  const isBusy = isUpdatingEnabled || isUpdatingTraceRecording;

  const handleEnabledChange = (next: boolean) => {
    setAgentAssistantEnabled({
      variables: { input: { enabled: next } },
      onCompleted: (response) => {
        store.getState().setAgentsConfig({
          assistantEnabled: response.setAgentAssistantEnabled.enabled,
        });
      },
    });
  };

  const handleTraceRecordingChange = (patch: {
    allowLocalTraces?: boolean;
    allowRemoteExport?: boolean;
  }) => {
    const nextLocal = patch.allowLocalTraces ?? allowLocalTraces;
    const nextRemote = patch.allowRemoteExport ?? allowRemoteExport;
    setTraceRecording({
      variables: {
        input: {
          allowLocalTraces: nextLocal,
          allowRemoteExport: nextRemote,
        },
      },
      onCompleted: (response) => {
        store.getState().setAgentsConfig({
          allowLocalTraces: response.setAgentTraceRecording.allowLocalTraces,
          allowRemoteExport: response.setAgentTraceRecording.allowRemoteExport,
        });
      },
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Flex direction="column" gap="size-150">
      <Text color="text-500">
        {forceTracing
          ? "PXI tracing, remote export, and user attribution are enabled for all users by PHOENIX_AGENTS_FORCE_TRACING."
          : "Applies to all users. When a system setting is off, the matching personal setting is unavailable."}
      </Text>
      <ul css={settingsListCSS}>
        <li css={settingRowCSS}>
          <AdminSettingsSwitch
            label="Assistant access"
            description="Controls whether users can open the assistant."
            isSelected={assistantEnabled}
            onChange={handleEnabledChange}
            isDisabled={isBusy}
          />
        </li>
        <li css={settingRowCSS}>
          <AdminSettingsSwitch
            label="Save traces in this Phoenix instance"
            description="Allows users to store assistant session traces in this Phoenix instance."
            isSelected={allowLocalTraces}
            onChange={(allowLocalTraces) =>
              handleTraceRecordingChange({ allowLocalTraces })
            }
            isDisabled={isBusy || forceTracing}
          />
        </li>
        {isRemoteCollectorConfigured ? (
          <li css={settingRowCSS}>
            <AdminSettingsSwitch
              label="Exporting traces"
              description="Allows users to export assistant session traces to the configured remote collector."
              isSelected={allowRemoteExport}
              onChange={(allowRemoteExport) =>
                handleTraceRecordingChange({ allowRemoteExport })
              }
              isDisabled={isBusy || forceTracing}
            />
          </li>
        ) : null}
      </ul>
    </Flex>
  );
}

function AdminSettingsSwitch({
  label,
  description,
  isSelected,
  onChange,
  isDisabled,
}: {
  label: string;
  description: string;
  isSelected: boolean;
  onChange: (next: boolean) => void;
  isDisabled: boolean;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      labelPlacement="start"
      css={settingSwitchCSS}
    >
      <span className="assistant-admin-settings__label">
        <Text weight="heavy">{label}</Text>
        <Text color="text-500" size="S">
          {description}
        </Text>
      </span>
    </Switch>
  );
}
