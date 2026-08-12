import { css } from "@emotion/react";

import { getAgentCapabilityDefinition } from "@phoenix/agent/extensions/capabilities";
import { Switch, Text } from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";

import { SystemSettingsWarning } from "./SystemSettingsWarning";

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

  .agent-settings__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

export function AgentWebAccessSettings() {
  const store = useAgentStore();
  const capabilities = useAgentContext((state) => state.capabilities);
  const isWebAccessEnabled = useAgentContext(
    (state) => state.agentsConfig.webAccessEnabled
  );
  const isAdmin = useIsAdminOrAuthDisabled();
  const definition = getAgentCapabilityDefinition("web.access");

  return (
    <ul css={settingsListCSS}>
      <li css={settingRowCSS}>
        <Switch
          isSelected={isWebAccessEnabled && capabilities[definition.key]}
          isDisabled={!isWebAccessEnabled}
          onChange={(enabled) => {
            store.getState().setCapability({ key: definition.key, enabled });
          }}
          labelPlacement="start"
          css={settingSwitchCSS}
        >
          <span className="agent-settings__label">
            <Text weight="heavy" size="M">
              {definition.label}
            </Text>
            <Text color="text-500">{definition.description}</Text>
          </span>
        </Switch>
        {/* Web access is env-only — the system settings section cannot enable it. */}
        {!isWebAccessEnabled ? (
          <SystemSettingsWarning
            isAdmin={isAdmin}
            adminMessage={
              <>
                Disabled by server configuration (
                <code>PHOENIX_ALLOW_EXTERNAL_RESOURCES</code> /{" "}
                <code>PHOENIX_AGENTS_DISABLE_WEB_ACCESS</code>).
              </>
            }
          />
        ) : null}
      </li>
    </ul>
  );
}

export function AgentSubagentsSettings() {
  const store = useAgentStore();
  const capabilities = useAgentContext((state) => state.capabilities);
  const definition = getAgentCapabilityDefinition("subagents.enabled");

  return (
    <ul css={settingsListCSS}>
      <li css={settingRowCSS}>
        <Switch
          isSelected={capabilities[definition.key]}
          onChange={(enabled) => {
            store.getState().setCapability({ key: definition.key, enabled });
          }}
          labelPlacement="start"
          css={settingSwitchCSS}
        >
          <span className="agent-settings__label">
            <Text weight="heavy" size="M">
              {definition.label}
            </Text>
            <Text color="text-500">{definition.description}</Text>
          </span>
        </Switch>
      </li>
    </ul>
  );
}
