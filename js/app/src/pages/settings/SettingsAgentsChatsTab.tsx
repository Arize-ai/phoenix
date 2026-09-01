import { css } from "@emotion/react";
import { graphql, useMutation } from "react-relay";

import { Flex, Input, NumberField, Text } from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SettingsAgentsChatsTabSetAgentSessionRetentionMutation } from "./__generated__/SettingsAgentsChatsTabSetAgentSessionRetentionMutation.graphql";
import type { SettingsAgentSessionsCard_sessions$key } from "./__generated__/SettingsAgentSessionsCard_sessions.graphql";
import { SettingsAgentSessionsCard } from "./SettingsAgentSessionsCard";
import {
  SettingsAgentsSection,
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
} from "./SettingsAgentsShared";

/**
 * Values restored when an admin re-enables a retention rule that was off
 */
const DEFAULT_SESSION_RETENTION_MAX_IDLE_DAYS = 30;
const DEFAULT_SESSION_RETENTION_MAX_COUNT_PER_USER = 30;

const settingValueCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);

  .assistant-retention__value-input {
    width: var(--global-dimension-size-1000);

    .react-aria-Input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
  }
`;

/**
 * A retention rule row: a switch that turns the rule on and off, plus a
 * number input for the rule's value while it is on. Re-enabling restores
 * {@link RetentionRuleSettingProps.enabledDefault}.
 */
type RetentionRuleSettingProps = {
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

function RetentionRuleSetting({
  label,
  description,
  valueLabel,
  unit,
  value,
  onChange,
  enabledDefault,
  isDisabled,
}: RetentionRuleSettingProps) {
  const isEnabled = value !== null;
  return (
    <li>
      <SettingsSwitchRow
        title={label}
        titleExtra={<SystemBadge />}
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
            className="assistant-retention__value-input"
          >
            <Input />
          </NumberField>
          <Text color="text-500" size="S">
            {unit}
          </Text>
        </div>
      ) : null}
    </li>
  );
}

/**
 * System-scoped retention rules for every user's saved chats. Rendered only
 * for admins.
 */
function SettingsAgentsRetentionSection() {
  const sessionRetentionMaxIdleDays = useAgentContext(
    (state) => state.agentsConfig.sessionRetentionMaxIdleDays
  );
  const sessionRetentionMaxCountPerUser = useAgentContext(
    (state) => state.agentsConfig.sessionRetentionMaxCountPerUser
  );
  const store = useAgentStore();
  const notifyError = useNotifyError();

  const [setSessionRetention, isUpdatingSessionRetention] =
    useMutation<SettingsAgentsChatsTabSetAgentSessionRetentionMutation>(graphql`
      mutation SettingsAgentsChatsTabSetAgentSessionRetentionMutation(
        $input: SetAgentSessionRetentionInput!
      ) {
        setAgentSessionRetention(input: $input) {
          maxIdleDays
          maxCountPerUser
        }
      }
    `);

  const handleSessionRetentionChange = (patch: {
    maxIdleDays?: number | null;
    maxCountPerUser?: number | null;
  }) => {
    const input = {
      ...(patch.maxIdleDays !== undefined && {
        maxIdleDays: patch.maxIdleDays,
      }),
      ...(patch.maxCountPerUser !== undefined && {
        maxCountPerUser: patch.maxCountPerUser,
      }),
    };
    // Apply optimistically: the controlled switch and number input would
    // otherwise display the old values until the mutation round-trip
    // completes. Reverted in onError.
    store.getState().setAgentsConfig({
      ...(patch.maxIdleDays !== undefined && {
        sessionRetentionMaxIdleDays: patch.maxIdleDays,
      }),
      ...(patch.maxCountPerUser !== undefined && {
        sessionRetentionMaxCountPerUser: patch.maxCountPerUser,
      }),
    });
    setSessionRetention({
      variables: { input },
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
          ...(patch.maxIdleDays !== undefined && {
            sessionRetentionMaxIdleDays,
          }),
          ...(patch.maxCountPerUser !== undefined && {
            sessionRetentionMaxCountPerUser,
          }),
        });
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update chat retention",
          message: messages?.[0] ?? error.message,
        });
      },
    });
  };

  return (
    <SettingsAgentsSection
      title="Retention"
      description="Applies to every user's saved chats on this Phoenix instance."
    >
      <ul css={settingsRowsCSS}>
        <RetentionRuleSetting
          label="Delete idle chats"
          description="Deletes each user's saved chats after the specified number of days without activity."
          valueLabel="Days of inactivity before deletion"
          unit="days"
          value={sessionRetentionMaxIdleDays}
          onChange={(maxIdleDays) =>
            handleSessionRetentionChange({ maxIdleDays })
          }
          enabledDefault={DEFAULT_SESSION_RETENTION_MAX_IDLE_DAYS}
          isDisabled={isUpdatingSessionRetention}
        />
        <RetentionRuleSetting
          label="Limit saved chats per user"
          description="Keeps each user's saved chats under the specified limit; the least recently used chats are deleted on an hourly cadence."
          valueLabel="Maximum saved chats per user"
          unit="chats"
          value={sessionRetentionMaxCountPerUser}
          onChange={(maxCountPerUser) =>
            handleSessionRetentionChange({ maxCountPerUser })
          }
          enabledDefault={DEFAULT_SESSION_RETENTION_MAX_COUNT_PER_USER}
          isDisabled={isUpdatingSessionRetention}
        />
      </ul>
    </SettingsAgentsSection>
  );
}

/**
 * Chats & data tab: system-scoped retention rules for saved chats and the
 * saved assistant sessions list.
 */
export function SettingsAgentsChatsTab({
  query,
}: {
  query: SettingsAgentSessionsCard_sessions$key;
}) {
  const isAdmin = useIsAdminOrAuthDisabled();
  return (
    <Flex direction="column" gap="size-300">
      {isAdmin ? <SettingsAgentsRetentionSection /> : null}
      <SettingsAgentSessionsCard query={query} />
    </Flex>
  );
}
