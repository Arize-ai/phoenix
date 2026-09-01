import { css } from "@emotion/react";
import { graphql } from "react-relay";

import { Alert, Flex, Radio, RadioGroup, Text } from "@phoenix/components";
import { EDIT_PERMISSION_MODES } from "@phoenix/components/agent/AgentEditPermissionMenu";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import type { AgentEditPermissionMode } from "@phoenix/store";

import type { SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation } from "./__generated__/SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation.graphql";
import {
  SettingsAgentsSection,
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
  useAgentsConfigMutation,
} from "./SettingsAgentsShared";

/**
 * Longer explanations shown on the settings page radio cards. The short
 * descriptions from {@link EDIT_PERMISSION_MODES} stay in the prompt-input
 * menu where space is tight.
 */
const EDIT_PERMISSION_MODE_DETAILS: Record<AgentEditPermissionMode, string> = {
  manual:
    "PXI asks before applying edits. Each proposed change is shown as a diff you can accept or reject.",
  bypass:
    "Edits are applied without asking. Changes are still visible in the chat and can be rewound.",
};

/**
 * The radio options share a single bordered card with a separator between
 * rows — matching the grouped settings cards — so the group reads as one
 * setting. Selection is shown by the radio dot alone.
 */
const editApprovalRadioGroupCSS = css`
  width: 100%;
  gap: 0;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-primary);

  .assistant-permissions__radio-label {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
  }

  .radio {
    width: 100%;
    box-sizing: border-box;
    align-items: flex-start;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-150);

    &:before {
      flex: 0 0 auto;
    }

    & + .radio {
      border-top: 1px solid var(--global-border-color-default);
    }
  }
`;

/**
 * System-scoped switch controlling whether anyone on this Phoenix instance
 * can open the assistant. Rendered only for admins.
 */
function AssistantAccessSystemSetting() {
  const assistantEnabled = useAgentContext(
    (state) => state.agentsConfig.assistantEnabled
  );

  const [setAgentAssistantEnabled, isUpdatingEnabled] =
    useAgentsConfigMutation<SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation>(
      {
        mutation: graphql`
          mutation SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation(
            $input: SetAgentAssistantEnabledInput!
          ) {
            setAgentAssistantEnabled(input: $input) {
              enabled
            }
          }
        `,
        errorTitle: "Failed to update assistant access",
        applyResponse: (response) => ({
          assistantEnabled: response.setAgentAssistantEnabled.enabled,
        }),
      }
    );

  return (
    <li>
      <SettingsSwitchRow
        title="Assistant access"
        titleExtra={<SystemBadge />}
        description="Controls whether users can open the assistant. When off, the assistant is hidden for everyone and personal settings are unavailable."
        isSelected={assistantEnabled}
        onChange={(next) =>
          setAgentAssistantEnabled({ input: { enabled: next } })
        }
        isDisabled={isUpdatingEnabled}
      />
    </li>
  );
}

/**
 * The default edit-approval mode, presented as radio cards. Writes the same
 * store value as the prompt input's edit-permission menu, so the two surfaces
 * stay in sync.
 */
function EditApprovalSetting() {
  const editPermissionMode = useAgentContext(
    (state) => state.permissions.edits
  );
  const setPermissions = useAgentContext((state) => state.setPermissions);
  return (
    <RadioGroup
      aria-label="Edit approvals"
      direction="column"
      value={editPermissionMode}
      onChange={(value) => {
        setPermissions({ edits: value as AgentEditPermissionMode });
      }}
      css={editApprovalRadioGroupCSS}
    >
      {EDIT_PERMISSION_MODES.map((meta) => (
        <Radio key={meta.mode} value={meta.mode}>
          {/* slot={null} opts out of RadioGroup's slotted TextContext, which
              would otherwise reject an unslotted <Text> at render. */}
          <span className="assistant-permissions__radio-label">
            <Text slot={null} weight="heavy">
              {meta.label}
            </Text>
            <Text slot={null} color="text-500" size="S">
              {EDIT_PERMISSION_MODE_DETAILS[meta.mode]}
            </Text>
          </span>
        </Radio>
      ))}
    </RadioGroup>
  );
}

/**
 * Permissions tab: who can use the assistant (system-scoped) and how the
 * assistant's edits and tool actions get approved.
 */
export function SettingsAgentsPermissionsTab() {
  const isAdmin = useIsAdminOrAuthDisabled();
  return (
    <Flex direction="column" gap="size-300">
      {isAdmin ? (
        <SettingsAgentsSection
          title="Access"
          description="Who can use the assistant on this Phoenix instance."
        >
          <ul css={settingsRowsCSS}>
            <AssistantAccessSystemSetting />
          </ul>
        </SettingsAgentsSection>
      ) : null}
      <SettingsAgentsSection
        title="Edit approvals"
        description="How the assistant applies edits to prompts, datasets, annotations, and other Phoenix resources. You can also change this from the chat prompt input (Ctrl+T)."
      >
        <EditApprovalSetting />
      </SettingsAgentsSection>
      <SettingsAgentsSection
        title="Tool approvals"
        description="Approvals for individual tool actions are handled in chat."
      >
        <Alert variant="info">
          Writes to Phoenix resources such as datasets, annotations, and
          experiments always ask in chat before running. Read-only tools run
          without approval.
        </Alert>
      </SettingsAgentsSection>
    </Flex>
  );
}
