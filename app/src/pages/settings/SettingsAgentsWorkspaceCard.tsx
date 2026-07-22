import { css } from "@emotion/react";
import { graphql, useMutation } from "react-relay";

import { Flex, Input, NumberField, Switch, Text } from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation.graphql";
import type { SettingsAgentsWorkspaceCardSetSessionRetentionMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetSessionRetentionMutation.graphql";
import type { SettingsAgentsWorkspaceCardSetTraceRecordingMutation } from "./__generated__/SettingsAgentsWorkspaceCardSetTraceRecordingMutation.graphql";

/**
 * Values restored when an admin re-enables a retention rule that was off
 */
const DEFAULT_SESSION_RETENTION_MAX_IDLE_DAYS = 7;
const DEFAULT_SESSION_RETENTION_MAX_COUNT_PER_USER = 30;

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

const settingValueCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);

  .assistant-admin-settings__value-input {
    width: var(--global-dimension-size-1000);

    .react-aria-Input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
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
  const sessionRetentionMaxIdleDays = useAgentContext(
    (state) => state.agentsConfig.sessionRetentionMaxIdleDays
  );
  const sessionRetentionMaxCountPerUser = useAgentContext(
    (state) => state.agentsConfig.sessionRetentionMaxCountPerUser
  );
  const store = useAgentStore();
  const notifyError = useNotifyError();

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

  const [setSessionRetention, isUpdatingSessionRetention] =
    useMutation<SettingsAgentsWorkspaceCardSetSessionRetentionMutation>(graphql`
      mutation SettingsAgentsWorkspaceCardSetSessionRetentionMutation(
        $input: SetAgentSessionRetentionInput!
      ) {
        setAgentSessionRetention(input: $input) {
          maxIdleDays
          maxCountPerUser
        }
      }
    `);

  const isBusy =
    isUpdatingEnabled || isUpdatingTraceRecording || isUpdatingSessionRetention;

  const handleEnabledChange = (next: boolean) => {
    setAgentAssistantEnabled({
      variables: { input: { enabled: next } },
      onCompleted: (response) => {
        store.getState().setAgentsConfig({
          assistantEnabled: response.setAgentAssistantEnabled.enabled,
        });
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update assistant access",
          message: messages?.[0] ?? error.message,
        });
      },
    });
  };

  const handleSessionRetentionChange = (patch: {
    maxIdleDays?: number | null;
    maxCountPerUser?: number | null;
  }) => {
    const maxIdleDays =
      patch.maxIdleDays !== undefined
        ? patch.maxIdleDays
        : sessionRetentionMaxIdleDays;
    const maxCountPerUser =
      patch.maxCountPerUser !== undefined
        ? patch.maxCountPerUser
        : sessionRetentionMaxCountPerUser;
    // Apply optimistically: the controlled switch and number input would
    // otherwise display the old values until the mutation round-trip
    // completes. Reverted in onError.
    store.getState().setAgentsConfig({
      sessionRetentionMaxIdleDays: maxIdleDays,
      sessionRetentionMaxCountPerUser: maxCountPerUser,
    });
    setSessionRetention({
      variables: {
        input: {
          maxIdleDays,
          maxCountPerUser,
        },
      },
      onCompleted: (response) => {
        store.getState().setAgentsConfig({
          sessionRetentionMaxIdleDays:
            response.setAgentSessionRetention.maxIdleDays,
          sessionRetentionMaxCountPerUser:
            response.setAgentSessionRetention.maxCountPerUser,
        });
      },
      onError: (error) => {
        store.getState().setAgentsConfig({
          sessionRetentionMaxIdleDays,
          sessionRetentionMaxCountPerUser,
        });
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update chat retention",
          message: messages?.[0] ?? error.message,
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
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update trace recording",
          message: messages?.[0] ?? error.message,
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
        <li css={settingRowCSS}>
          <AdminRetentionSetting
            label="Delete idle chats"
            description="Deletes each user's saved chats after the specified number of days without activity."
            valueLabel="Days of inactivity before deletion"
            unit="days"
            value={sessionRetentionMaxIdleDays}
            onChange={(maxIdleDays) =>
              handleSessionRetentionChange({ maxIdleDays })
            }
            enabledDefault={DEFAULT_SESSION_RETENTION_MAX_IDLE_DAYS}
            isDisabled={isBusy}
          />
        </li>
        <li css={settingRowCSS}>
          <AdminRetentionSetting
            label="Limit saved chats per user"
            description="Keeps each user's saved chats under the specified limit; the least recently used chats are deleted on an hourly cadence."
            valueLabel="Maximum saved chats per user"
            unit="chats"
            value={sessionRetentionMaxCountPerUser}
            onChange={(maxCountPerUser) =>
              handleSessionRetentionChange({ maxCountPerUser })
            }
            enabledDefault={DEFAULT_SESSION_RETENTION_MAX_COUNT_PER_USER}
            isDisabled={isBusy}
          />
        </li>
      </ul>
    </Flex>
  );
}

/**
 * A retention rule row: a switch that turns the rule on and off, plus a
 * number input for the rule's value while it is on. Re-enabling restores
 * {@link AdminRetentionSettingProps.enabledDefault}.
 */
type AdminRetentionSettingProps = {
  label: string;
  description: string;
  /** Accessible label for the number input. */
  valueLabel: string;
  /** Unit text rendered beside the number input (e.g. "days"). */
  unit: string;
  value: number | null;
  onChange: (value: number | null) => void;
  enabledDefault: number;
  isDisabled: boolean;
};

function AdminRetentionSetting({
  label,
  description,
  valueLabel,
  unit,
  value,
  onChange,
  enabledDefault,
  isDisabled,
}: AdminRetentionSettingProps) {
  const isEnabled = value !== null;
  return (
    <>
      <AdminSettingsSwitch
        label={label}
        description={description}
        isSelected={isEnabled}
        onChange={(enabled) => onChange(enabled ? enabledDefault : null)}
        isDisabled={isDisabled}
      />
      {isEnabled ? (
        <div css={settingValueCSS}>
          <NumberField
            aria-label={valueLabel}
            value={value}
            minValue={1}
            formatOptions={{ maximumFractionDigits: 0 }}
            onChange={(nextValue) => {
              if (Number.isFinite(nextValue) && nextValue > 0) {
                onChange(nextValue);
              }
            }}
            isDisabled={isDisabled}
            size="S"
            className="assistant-admin-settings__value-input"
          >
            <Input />
          </NumberField>
          <Text color="text-500" size="S">
            {unit}
          </Text>
        </div>
      ) : null}
    </>
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
