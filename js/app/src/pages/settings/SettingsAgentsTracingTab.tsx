import { css } from "@emotion/react";
import { graphql } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import {
  AgentTraceAttributionSettingRow,
  AgentTraceExportSettingRow,
  AgentTraceSavingSettingRow,
} from "@phoenix/components/agent";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";

import type { SettingsAgentsTracingTabSetAgentTraceRecordingMutation } from "./__generated__/SettingsAgentsTracingTabSetAgentTraceRecordingMutation.graphql";
import {
  groupedSettingsRowsCSS,
  SettingsAgentsSection,
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
  useAgentsConfigMutation,
} from "./SettingsAgentsShared";

const codeCSS = css`
  font-family: var(--global-font-family-mono);
  font-size: 0.95em;
`;

/**
 * Tracing & privacy tab: each system gate is paired with the personal toggle
 * it controls in one grouped card, so the gating dependency is visible in
 * place instead of being explained by a warning banner alone.
 */
export function SettingsAgentsTracingTab() {
  const isAdmin = useIsAdminOrAuthDisabled();
  const isRemoteCollectorConfigured = useAgentContext((state) =>
    Boolean(state.agentsConfig.collectorEndpoint)
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
  const [setTraceRecording, isUpdatingTraceRecording] =
    useAgentsConfigMutation<SettingsAgentsTracingTabSetAgentTraceRecordingMutation>(
      {
        mutation: graphql`
          mutation SettingsAgentsTracingTabSetAgentTraceRecordingMutation(
            $input: SetAgentTraceRecordingInput!
          ) {
            setAgentTraceRecording(input: $input) {
              allowLocalTraces
              allowRemoteExport
            }
          }
        `,
        errorTitle: "Failed to update trace recording",
        applyResponse: (response) => ({
          allowLocalTraces: response.setAgentTraceRecording.allowLocalTraces,
          allowRemoteExport: response.setAgentTraceRecording.allowRemoteExport,
        }),
      }
    );

  const handleTraceRecordingChange = (patch: {
    allowLocalTraces?: boolean;
    allowRemoteExport?: boolean;
  }) => {
    setTraceRecording({
      input: {
        allowLocalTraces: patch.allowLocalTraces ?? allowLocalTraces,
        allowRemoteExport: patch.allowRemoteExport ?? allowRemoteExport,
      },
    });
  };

  return (
    <Flex direction="column" gap="size-300">
      <Text color="text-500" size="XS">
        Session traces are unredacted and include prompts, replies, tool calls,
        tool results, and any Phoenix data the assistant read.
        {isAdmin ? (
          <>
            {" "}
            A <SystemBadge /> setting gates the personal setting below it — when
            the system setting is off, the personal one is unavailable.
          </>
        ) : null}
      </Text>
      <SettingsAgentsSection
        title="Trace saving"
        description="Traces stored inside this Phoenix instance."
      >
        <ul css={isAdmin ? groupedSettingsRowsCSS : settingsRowsCSS}>
          {isAdmin ? (
            <li>
              <SettingsSwitchRow
                title="Allow saving traces"
                titleExtra={<SystemBadge />}
                description="Allows users to store assistant session traces in this Phoenix instance."
                isSelected={allowLocalTraces}
                onChange={(nextAllowLocalTraces) =>
                  handleTraceRecordingChange({
                    allowLocalTraces: nextAllowLocalTraces,
                  })
                }
                isDisabled={isUpdatingTraceRecording || forceTracing}
              />
            </li>
          ) : null}
          <AgentTraceSavingSettingRow isOnSettingsPage />
        </ul>
      </SettingsAgentsSection>
      {isRemoteCollectorConfigured ? (
        <SettingsAgentsSection
          title="Trace export"
          description="Traces sent to the remote collector configured for this deployment."
        >
          <ul css={isAdmin ? groupedSettingsRowsCSS : settingsRowsCSS}>
            {isAdmin ? (
              <li>
                <SettingsSwitchRow
                  title="Allow exporting traces"
                  titleExtra={<SystemBadge />}
                  description="Allows users to export assistant session traces to the configured remote collector."
                  isSelected={allowRemoteExport}
                  onChange={(nextAllowRemoteExport) =>
                    handleTraceRecordingChange({
                      allowRemoteExport: nextAllowRemoteExport,
                    })
                  }
                  isDisabled={isUpdatingTraceRecording || forceTracing}
                />
              </li>
            ) : null}
            <AgentTraceExportSettingRow isOnSettingsPage />
          </ul>
        </SettingsAgentsSection>
      ) : null}
      <SettingsAgentsSection
        title="Attribution"
        description="How recorded traces are tied back to you."
      >
        <ul css={settingsRowsCSS}>
          <AgentTraceAttributionSettingRow />
        </ul>
      </SettingsAgentsSection>
      {forceTracing ? (
        <Text color="text-500" size="XS">
          {isAdmin ? (
            <>
              <code css={codeCSS}>PHOENIX_AGENTS_FORCE_TRACING</code> is set on
              this deployment, so tracing, remote export, and user attribution
              are enabled for all users and these switches are disabled.
            </>
          ) : (
            "Tracing, remote export, and user attribution are enabled for all users by this Phoenix deployment."
          )}
        </Text>
      ) : null}
    </Flex>
  );
}
