import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ContextualHelp, Text } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import {
  SettingsSwitchRow,
  settingsRowsCSS,
} from "@phoenix/pages/settings/SettingsAgentsShared";
import {
  getEffectiveAttachUserId,
  getEffectiveTraceRecordingSettings,
} from "@phoenix/store/agentStore";

import { SystemSettingsWarning } from "./SystemSettingsWarning";

const settingsContainerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
`;

const codeCSS = css`
  font-family: var(--global-font-family-mono);
  font-size: 0.95em;
`;

const traceInfoTipCSS = css`
  display: inline-flex;
  flex: 0 0 auto;
`;

const traceDetailsTooltipCSS = css`
  max-width: 320px;
`;

function TraceInfoTip({ children }: { children: ReactNode }) {
  return (
    <span
      css={traceInfoTipCSS}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <ContextualHelp
        variant="info"
        placement="top"
        css={traceDetailsTooltipCSS}
      >
        {children}
      </ContextualHelp>
    </span>
  );
}

/**
 * Personal toggle for storing session traces in this Phoenix instance.
 * Renders a plain `<li>`; the enclosing list decides whether the row is a
 * standalone card or part of a grouped card.
 */
export function AgentTraceSavingSettingRow({
  isOnSettingsPage = false,
}: {
  /** See {@link SystemSettingsWarning}. */
  isOnSettingsPage?: boolean;
} = {}) {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const setObservability = useAgentContext((state) => state.setObservability);
  const isAdmin = useIsAdminOrAuthDisabled();
  const isTracingForced = agentsConfig.forceTracing;
  const localTracesOffInSystemSettings = !agentsConfig.allowLocalTraces;
  const effectiveRecording = getEffectiveTraceRecordingSettings({
    agentsConfig,
    observability,
  });
  return (
    <li>
      <SettingsSwitchRow
        title="Save assistant session traces in this Phoenix instance"
        titleExtra={
          <TraceInfoTip>
            Traces are unredacted and include prompts, replies, tool calls, tool
            results, and any Phoenix data the assistant read.
          </TraceInfoTip>
        }
        description={
          <>
            Stores full, unredacted traces in the{" "}
            <code css={codeCSS}>{agentsConfig.assistantProjectName}</code>{" "}
            project, visible to anyone with access to that project.
          </>
        }
        isSelected={effectiveRecording.ingestTraces}
        isDisabled={localTracesOffInSystemSettings || isTracingForced}
        onChange={(storeLocalTraces) => {
          setObservability({ storeLocalTraces });
        }}
      />
      {localTracesOffInSystemSettings ? (
        <SystemSettingsWarning
          isAdmin={isAdmin}
          isOnSettingsPage={isOnSettingsPage}
        />
      ) : null}
    </li>
  );
}

/**
 * Personal toggle for exporting session traces to the configured remote
 * collector. Renders nothing when no remote collector is configured.
 */
export function AgentTraceExportSettingRow({
  isOnSettingsPage = false,
}: {
  /** See {@link SystemSettingsWarning}. */
  isOnSettingsPage?: boolean;
} = {}) {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const setObservability = useAgentContext((state) => state.setObservability);
  const isAdmin = useIsAdminOrAuthDisabled();
  const isRemoteCollectorConfigured = Boolean(agentsConfig.collectorEndpoint);
  const isTracingForced = agentsConfig.forceTracing;
  const remoteExportOffInSystemSettings = !agentsConfig.allowRemoteExport;
  const effectiveRecording = getEffectiveTraceRecordingSettings({
    agentsConfig,
    observability,
  });
  if (!isRemoteCollectorConfigured) {
    return null;
  }
  return (
    <li>
      <SettingsSwitchRow
        title="Exporting traces"
        titleExtra={
          <TraceInfoTip>
            Exported traces are unredacted and include prompts, replies, tool
            calls, tool results, and any Phoenix data the assistant read. They
            are sent to{" "}
            <code css={codeCSS}>{agentsConfig.collectorEndpoint}</code>.
          </TraceInfoTip>
        }
        description="Share session traces with the developers of Phoenix to help improve the assistant. Sent securely and never shared."
        isSelected={effectiveRecording.exportRemoteTraces}
        isDisabled={remoteExportOffInSystemSettings || isTracingForced}
        onChange={(exportRemoteTraces) => {
          setObservability({ exportRemoteTraces });
        }}
      />
      {remoteExportOffInSystemSettings ? (
        <SystemSettingsWarning
          isAdmin={isAdmin}
          isOnSettingsPage={isOnSettingsPage}
        />
      ) : null}
    </li>
  );
}

/**
 * Personal toggle for tagging recorded traces with the viewer's account
 * email. Inert unless trace saving or export is effectively on.
 */
export function AgentTraceAttributionSettingRow() {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const setObservability = useAgentContext((state) => state.setObservability);
  const isTracingForced = agentsConfig.forceTracing;
  // Attaching an email only affects traces that are actually recorded, so the
  // toggle is inert unless saving or exporting is effectively on.
  const effectiveRecording = getEffectiveTraceRecordingSettings({
    agentsConfig,
    observability,
  });
  const isTracingEnabled =
    effectiveRecording.ingestTraces || effectiveRecording.exportRemoteTraces;
  const effectiveAttachUserId = getEffectiveAttachUserId({
    agentsConfig,
    observability,
  });
  return (
    <li>
      <SettingsSwitchRow
        title="Attach your email to session traces"
        description="Tags session traces with your Phoenix account email so sessions can be filtered by user. Applies only when you are signed in and trace saving or export is on."
        isSelected={effectiveAttachUserId}
        isDisabled={!isTracingEnabled || isTracingForced}
        onChange={(attachUserId) => {
          setObservability({ attachUserId });
        }}
      />
    </li>
  );
}

/**
 * The observability rows as a standalone card stack, used outside the
 * settings page (e.g. the consent gate).
 */
export function AgentObservabilitySettings() {
  const isTracingForced = useAgentContext(
    (state) => state.agentsConfig.forceTracing
  );
  return (
    <div css={settingsContainerCSS}>
      <Text color="text-500" size="S">
        {isTracingForced
          ? "Tracing, remote export, and user attribution are enabled for all users by this Phoenix deployment."
          : "These settings apply only to this browser."}
      </Text>
      <ul css={settingsRowsCSS}>
        <AgentTraceSavingSettingRow />
        <AgentTraceExportSettingRow />
        <AgentTraceAttributionSettingRow />
      </ul>
    </div>
  );
}
