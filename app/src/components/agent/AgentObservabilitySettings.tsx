import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ContextualHelp, Switch, Text } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
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

  .agent-observability__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }

  .agent-observability__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }

  .agent-observability__help {
    display: inline-flex;
    flex: 0 0 auto;
  }
`;

const codeCSS = css`
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95em;
`;

const traceDetailsTooltipCSS = css`
  max-width: 320px;
`;

function TraceInfoTip({ children }: { children: ReactNode }) {
  return (
    <span
      className="agent-observability__help"
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

export function AgentObservabilitySettings({
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

  const localTracesOffInSystemSettings = !agentsConfig.allowLocalTraces;
  const remoteExportOffInSystemSettings = !agentsConfig.allowRemoteExport;

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
    <div css={settingsContainerCSS}>
      {isTracingForced ? (
        <Text color="text-500" size="S">
          Tracing, remote export, and user attribution are enabled for all users
          by this Phoenix deployment.
        </Text>
      ) : !isOnSettingsPage ? (
        <Text color="text-500" size="S">
          These settings apply only to this browser.
        </Text>
      ) : null}
      <ul css={settingsListCSS}>
        <li css={settingRowCSS}>
          <Switch
            isSelected={effectiveRecording.ingestTraces}
            isDisabled={localTracesOffInSystemSettings || isTracingForced}
            onChange={(storeLocalTraces) => {
              setObservability({ storeLocalTraces });
            }}
            labelPlacement="start"
            css={settingSwitchCSS}
          >
            <span className="agent-observability__label">
              <span className="agent-observability__title">
                <Text weight="heavy" size="M">
                  Save assistant session traces in this Phoenix instance
                </Text>
                <TraceInfoTip>
                  Traces are unredacted and include prompts, replies, tool
                  calls, tool results, and any Phoenix data the assistant read.
                </TraceInfoTip>
              </span>
              <Text color="text-500">
                Stores full, unredacted traces in the{" "}
                <code css={codeCSS}>{agentsConfig.assistantProjectName}</code>{" "}
                project, visible to anyone with access to that project.
              </Text>
            </span>
          </Switch>
          {localTracesOffInSystemSettings ? (
            <SystemSettingsWarning
              isAdmin={isAdmin}
              isOnSettingsPage={isOnSettingsPage}
            />
          ) : null}
        </li>
        {isRemoteCollectorConfigured ? (
          <li css={settingRowCSS}>
            <Switch
              isSelected={effectiveRecording.exportRemoteTraces}
              isDisabled={remoteExportOffInSystemSettings || isTracingForced}
              onChange={(exportRemoteTraces) => {
                setObservability({ exportRemoteTraces });
              }}
              labelPlacement="start"
              css={settingSwitchCSS}
            >
              <span className="agent-observability__label">
                <span className="agent-observability__title">
                  <Text weight="heavy" size="M">
                    Exporting traces
                  </Text>
                  <TraceInfoTip>
                    Exported traces are unredacted and include prompts, replies,
                    tool calls, tool results, and any Phoenix data the assistant
                    read. They are sent to{" "}
                    <code css={codeCSS}>{agentsConfig.collectorEndpoint}</code>.
                  </TraceInfoTip>
                </span>
                <Text color="text-500">
                  Share session traces with the developers of Phoenix to help
                  improve the assistant. Sent securely and never shared.
                </Text>
              </span>
            </Switch>
            {remoteExportOffInSystemSettings ? (
              <SystemSettingsWarning
                isAdmin={isAdmin}
                isOnSettingsPage={isOnSettingsPage}
              />
            ) : null}
          </li>
        ) : null}
        <li css={settingRowCSS}>
          <Switch
            isSelected={effectiveAttachUserId}
            isDisabled={!isTracingEnabled || isTracingForced}
            onChange={(attachUserId) => {
              setObservability({ attachUserId });
            }}
            labelPlacement="start"
            css={settingSwitchCSS}
          >
            <span className="agent-observability__label">
              <Text weight="heavy" size="M">
                Attach your email to session traces
              </Text>
              <Text color="text-500">
                Tags session traces with your Phoenix account email so sessions
                can be filtered by user. Applies only when you are signed in and
                trace saving or export is on.
              </Text>
            </span>
          </Switch>
        </li>
      </ul>
    </div>
  );
}
