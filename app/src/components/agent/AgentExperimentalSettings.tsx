import { css } from "@emotion/react";

import { getAgentCapabilitiesForControlSurface } from "@phoenix/agent/extensions/capabilities";
import { Alert, Flex, Switch, Text, View } from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

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

  .agent-experimental__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

const detailsCSS = css`
  summary {
    cursor: pointer;
  }
`;

export function AgentExperimentalSettings() {
  const store = useAgentStore();
  const capabilities = useAgentContext((state) => state.capabilities);
  const isWebAccessEnabled = useAgentContext(
    (state) => state.agentsConfig.webAccessEnabled
  );
  const experimentalCapabilities = getAgentCapabilitiesForControlSurface(
    "experimental-settings"
  ).filter(
    (definition) => definition.key !== "web.access" || isWebAccessEnabled
  );

  if (experimentalCapabilities.length === 0) {
    return null;
  }

  return (
    <details css={detailsCSS}>
      <summary>Experimental Features</summary>
      <View paddingTop="size-150">
        <Flex direction="column" gap="size-200">
          <Alert variant="warning" title="Experimental">
            These features are under active development and may change or be
            removed at any time.
          </Alert>
          <div css={settingsCSS}>
            {experimentalCapabilities.map((definition) => (
              <div key={definition.key} css={settingRowCSS}>
                <Switch
                  isSelected={capabilities[definition.key]}
                  onChange={(enabled) => {
                    store
                      .getState()
                      .setCapability({ key: definition.key, enabled });
                  }}
                  labelPlacement="start"
                  css={settingSwitchCSS}
                >
                  <span className="agent-experimental__label">
                    <Text weight="heavy" size="M">
                      {definition.label}
                    </Text>
                    <Text color="text-500">{definition.description}</Text>
                  </span>
                </Switch>
              </div>
            ))}
          </div>
        </Flex>
      </View>
    </details>
  );
}
