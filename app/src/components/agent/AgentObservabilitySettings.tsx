import { css } from "@emotion/react";

import { Switch, Text } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

const settingsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
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
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }
`;

const footerNoteCSS = css`
  display: block;
  color: var(--global-text-color-500);
`;

const codeCSS = css`
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95em;
`;

export function AgentObservabilitySettings() {
  const agentsConfig = useAgentContext((state) => state.agentsConfig);
  const observability = useAgentContext((state) => state.observability);
  const setObservability = useAgentContext((state) => state.setObservability);
  const isRemoteCollectorConfigured = Boolean(agentsConfig.collectorEndpoint);

  return (
    <div css={settingsCSS}>
      <div css={settingRowCSS}>
        <Switch
          isSelected={observability.storeLocalTraces}
          onChange={(storeLocalTraces) => {
            setObservability({ storeLocalTraces });
          }}
          labelPlacement="start"
          css={settingSwitchCSS}
        >
          <span className="agent-observability__label">
            <Text weight="heavy" size="M">
              Save PXI traces in this Phoenix app
            </Text>
            <Text color="text-500">
              This keeps traces in the{" "}
              <code css={codeCSS}>{agentsConfig.assistantProjectName}</code>{" "}
              project so you can review how PXI worked. If you run into an
              issue, you can share these traces with the Phoenix dev team.
            </Text>
          </span>
        </Switch>
      </div>
      <div css={settingRowCSS}>
        <Switch
          isSelected={
            isRemoteCollectorConfigured && observability.exportRemoteTraces
          }
          isDisabled={!isRemoteCollectorConfigured}
          onChange={(exportRemoteTraces) => {
            setObservability({ exportRemoteTraces });
          }}
          labelPlacement="start"
          css={settingSwitchCSS}
        >
          <span className="agent-observability__label">
            <Text weight="heavy" size="M">
              Share PXI traces with the team improving PXI
            </Text>
            <Text color="text-500">
              {agentsConfig.collectorEndpoint ? (
                <>
                  If enabled, PXI traces are also sent to the team working on
                  improving PXI. Sending destination:{" "}
                  <code css={codeCSS}>{agentsConfig.collectorEndpoint}</code>
                </>
              ) : (
                "Sharing to the PXI improvement team is not configured for this Phoenix app."
              )}
            </Text>
          </span>
        </Switch>
      </div>
      <Text css={footerNoteCSS} size="S">
        Trace links and feedback buttons only work when traces are saved in this
        Phoenix app.
      </Text>
    </div>
  );
}
