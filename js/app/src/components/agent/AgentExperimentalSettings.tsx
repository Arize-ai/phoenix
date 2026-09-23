import { getAgentCapabilityDefinition } from "@phoenix/agent/extensions/capabilities";
import { Badge, Icons } from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { SettingsSwitchRow } from "@phoenix/pages/settings/SettingsAgentsShared";

import { SystemSettingsWarning } from "./SystemSettingsWarning";

/**
 * Capability rows render plain `<li>`s; the enclosing list decides whether
 * each row is a standalone card or part of a grouped card.
 */
export function AgentWebAccessSettings() {
  const store = useAgentStore();
  const capabilities = useAgentContext((state) => state.capabilities);
  const isWebAccessEnabled = useAgentContext(
    (state) => state.agentsConfig.webAccessEnabled
  );
  const isAdmin = useIsAdminOrAuthDisabled();
  const definition = getAgentCapabilityDefinition("web.access");

  return (
    <li>
      <SettingsSwitchRow
        title={definition.label}
        icon={<Icons.Globe />}
        description={definition.description}
        isSelected={isWebAccessEnabled && capabilities[definition.key]}
        isDisabled={!isWebAccessEnabled}
        onChange={(enabled) => {
          store.getState().setCapability({ key: definition.key, enabled });
        }}
      />
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
  );
}

export function AgentSubagentsSettings() {
  const store = useAgentStore();
  const capabilities = useAgentContext((state) => state.capabilities);
  const definition = getAgentCapabilityDefinition("subagents.enabled");

  return (
    <li>
      <SettingsSwitchRow
        title={definition.label}
        icon={<Icons.Subagent />}
        titleExtra={
          <Badge size="S" variant="warning">
            experimental
          </Badge>
        }
        description={definition.description}
        isSelected={capabilities[definition.key]}
        onChange={(enabled) => {
          store.getState().setCapability({ key: definition.key, enabled });
        }}
      />
    </li>
  );
}
