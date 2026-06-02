import { css } from "@emotion/react";

import { ContextualHelp, Switch, Text } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

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

function TraceExportInfoTip({
  collectorEndpoint,
}: {
  collectorEndpoint: string;
}) {
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
        Exported traces are unredacted and include prompts, replies, tool calls,
        tool results, and any Phoenix data the assistant read. They are sent to{" "}
        <code css={codeCSS}>{collectorEndpoint}</code>.
      </ContextualHelp>
    </span>
  );
}

export function AgentObservabilitySettings() {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const setObservability = useAgentContext((state) => state.setObservability);
  const isRemoteCollectorConfigured = Boolean(agentsConfig.collectorEndpoint);

  const localTracesDisabledByAdmin = !agentsConfig.allowLocalTraces;
  const remoteExportDisabledByAdmin = !agentsConfig.allowRemoteExport;

  return (
    <div css={settingsContainerCSS}>
      <ul css={settingsListCSS}>
        <li css={settingRowCSS}>
          <Switch
            isSelected={
              !localTracesDisabledByAdmin && observability.storeLocalTraces
            }
            isDisabled={localTracesDisabledByAdmin}
            onChange={(storeLocalTraces) => {
              setObservability({ storeLocalTraces });
            }}
            labelPlacement="start"
            css={settingSwitchCSS}
          >
            <span className="agent-observability__label">
              <Text weight="heavy" size="M">
                Save assistant session traces in this Phoenix instance
              </Text>
              <Text color="text-500">
                Stores full, unredacted traces (prompts, replies, tool calls,
                tool results, and any Phoenix data the assistant read) in the{" "}
                <code css={codeCSS}>{agentsConfig.assistantProjectName}</code>{" "}
                project. Anyone with access to that project can view them. This
                setting applies only to this browser.
              </Text>
            </span>
          </Switch>
          {localTracesDisabledByAdmin ? <SystemSettingsWarning /> : null}
        </li>
        {isRemoteCollectorConfigured ? (
          <li css={settingRowCSS}>
            <Switch
              isSelected={
                isRemoteCollectorConfigured &&
                !remoteExportDisabledByAdmin &&
                observability.exportRemoteTraces
              }
              isDisabled={remoteExportDisabledByAdmin}
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
                  <TraceExportInfoTip
                    collectorEndpoint={agentsConfig.collectorEndpoint ?? ""}
                  />
                </span>
                <Text color="text-500">
                  Exports assistant session traces to{" "}
                  <code css={codeCSS}>{agentsConfig.collectorEndpoint}</code>.
                  This setting applies only to this browser.
                </Text>
              </span>
            </Switch>
            {remoteExportDisabledByAdmin ? <SystemSettingsWarning /> : null}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
