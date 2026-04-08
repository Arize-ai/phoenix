import type { Selection } from "react-aria-components";

import { getAgentCapabilitiesForControlSurface } from "@phoenix/agent/extensions/capabilities";
import {
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components";
import { PromptInputButton } from "@phoenix/components/ai/prompt-input";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

/** Capability controls that should be shown in the prompt toolbar debug menu. */
const debugMenuCapabilities =
  getAgentCapabilitiesForControlSurface("debug-menu");

function getSelectedCapabilityKeys(
  capabilities: Record<string, boolean>
): Selection {
  return new Set(
    debugMenuCapabilities
      .filter((definition) => capabilities[definition.key])
      .map((definition) => definition.key)
  );
}

function updateDebugCapabilities({
  selectedKeys,
  store,
}: {
  selectedKeys: Exclude<Selection, "all">;
  store: ReturnType<typeof useAgentStore>;
}) {
  for (const definition of debugMenuCapabilities) {
    store.getState().setCapability({
      key: definition.key,
      enabled: selectedKeys.has(definition.key),
    });
  }
}

/**
 * Renders the prompt-toolbar debug menu from capability metadata rather than
 * hardcoded toggles so new controls can be added by extending the registry.
 */
export function AgentDebugMenu() {
  const store = useAgentStore();
  const capabilities = useAgentContext((state) => state.capabilities);

  const selectedKeys = getSelectedCapabilityKeys(capabilities);

  return (
    <MenuTrigger>
      <PromptInputButton
        tooltip="Agent debug tools"
        aria-label="Agent debug tools"
      >
        <Icon svg={<Icons.WrenchOutline />} />
      </PromptInputButton>
      <MenuContainer placement="top start" maxHeight={350} minHeight={0}>
        <Menu
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={(keys: Selection) => {
            if (keys === "all") {
              return;
            }

            updateDebugCapabilities({ selectedKeys: keys, store });
          }}
        >
          {debugMenuCapabilities.map((definition) => (
            <MenuItem
              key={definition.key}
              id={definition.key}
              textValue={definition.label}
            >
              {definition.label}
            </MenuItem>
          ))}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
