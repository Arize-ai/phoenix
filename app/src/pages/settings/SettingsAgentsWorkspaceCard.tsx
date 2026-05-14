import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Card,
  Flex,
  Switch,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import type { SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation.graphql";
import type { SettingsAgentsWorkspaceCardSetTraceRecordingMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetTraceRecordingMutation.graphql";

const ADMIN_ONLY_TOOLTIP = "Only workspace admins can change this setting";

export function SettingsAgentsWorkspaceCard() {
  const { viewer } = useViewer();
  // Match IsAdminIfAuthEnabled server-side: no viewer ⇒ auth disabled ⇒ treat as admin
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
  const switchesDisabled = !isAdmin || isBusy;

  const handleEnabledChange = useCallback(
    (next: boolean) => {
      setAgentAssistantEnabled({
        variables: { input: { enabled: next } },
        onCompleted: (response) => {
          store.getState().setAgentsConfig({
            assistantEnabled: response.setAgentAssistantEnabled.enabled,
          });
        },
      });
    },
    [setAgentAssistantEnabled, store]
  );

  const handleTraceRecordingChange = useCallback(
    (patch: { allowLocalTraces?: boolean; allowRemoteExport?: boolean }) => {
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
            allowRemoteExport:
              response.setAgentTraceRecording.allowRemoteExport,
          });
        },
      });
    },
    [allowLocalTraces, allowRemoteExport, setTraceRecording, store]
  );

  return (
    <Card title="Workspace">
      <View padding="size-200">
        <Flex direction="column" gap="size-150">
          <Text color="text-500">
            {isAdmin
              ? "Configures defaults for all users in this workspace. Individual users may turn these off for themselves, but cannot turn them on if you disable them here."
              : "Set by your workspace admin. Your personal preferences below cannot exceed these."}
          </Text>
          <WorkspaceSwitch
            label="Available to this workspace"
            description="Master switch for the agent feature. When off, no user in this workspace can access agent chat."
            isSelected={assistantEnabled}
            onChange={handleEnabledChange}
            isDisabled={switchesDisabled}
            isAdmin={isAdmin}
          />
          <WorkspaceSwitch
            label="Allow saving PXI traces in this app"
            description="Permits users to store PXI session traces (prompts, replies, tool calls) in this Phoenix instance."
            isSelected={allowLocalTraces}
            onChange={(allowLocalTraces) =>
              handleTraceRecordingChange({ allowLocalTraces })
            }
            isDisabled={switchesDisabled}
            isAdmin={isAdmin}
          />
          {isRemoteCollectorConfigured ? (
            <WorkspaceSwitch
              label="Allow sharing PXI traces with the PXI team"
              description="Permits users to export PXI session traces to the remote collector configured for this Phoenix instance."
              isSelected={allowRemoteExport}
              onChange={(allowRemoteExport) =>
                handleTraceRecordingChange({ allowRemoteExport })
              }
              isDisabled={switchesDisabled}
              isAdmin={isAdmin}
            />
          ) : null}
        </Flex>
      </View>
    </Card>
  );
}

function WorkspaceSwitch({
  label,
  description,
  isSelected,
  onChange,
  isDisabled,
  isAdmin,
}: {
  label: string;
  description: string;
  isSelected: boolean;
  onChange: (next: boolean) => void;
  isDisabled: boolean;
  isAdmin: boolean;
}) {
  const switchEl = (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      labelPlacement="start"
    >
      <Flex direction="column" gap="size-50">
        <Text weight="heavy">{label}</Text>
        <Text color="text-500" size="S">
          {description}
        </Text>
      </Flex>
    </Switch>
  );

  if (isAdmin) {
    return switchEl;
  }
  // Non-admins see the read-only switch with an "admin only" tooltip on hover.
  return (
    <ReadOnlyTooltip>
      <div>{switchEl}</div>
    </ReadOnlyTooltip>
  );
}

function ReadOnlyTooltip({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TooltipTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children}
      <Tooltip>
        <TooltipArrow />
        {ADMIN_ONLY_TOOLTIP}
      </Tooltip>
    </TooltipTrigger>
  );
}
