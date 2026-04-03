import type { Selection } from "react-aria-components";

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

const MUTATIONS_KEY = "dangerouslyEnableMutations";

type AgentDebugMenuProps = {
  /**
   * Called after a permission toggle is committed to the store. The parent
   * component uses this to inject a synthetic tool-call message into the
   * chat history so the model is informed of the change.
   */
  onPermissionChange?: (permission: string, enabled: boolean) => void;
};

/**
 * Debug menu for the agent prompt input toolbar.
 *
 * Houses internal-only toggles that modify agent runtime behavior.
 * Currently supports:
 * - **Dangerously enable mutations**: allows the `phoenix-gql` CLI tool to
 *   execute GraphQL mutations and exposes mutation fields during schema
 *   introspection.
 */
export function AgentDebugMenu({ onPermissionChange }: AgentDebugMenuProps) {
  const store = useAgentStore();
  const dangerouslyEnableMutations = useAgentContext(
    (s) => s.debug.dangerouslyEnableMutations
  );

  const selectedKeys: Selection = new Set(
    dangerouslyEnableMutations ? [MUTATIONS_KEY] : []
  );

  return (
    <MenuTrigger>
      <PromptInputButton
        tooltip="Agent debug tools"
        aria-label="Agent debug tools"
      >
        <Icon svg={<Icons.WrenchOutline />} />
      </PromptInputButton>
      <MenuContainer placement="top start" maxHeight={350}>
        <Menu
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={(keys: Selection) => {
            if (keys === "all") return;
            const enabled = keys.has(MUTATIONS_KEY);
            store.getState().setDebug({
              dangerouslyEnableMutations: enabled,
            });
            onPermissionChange?.(MUTATIONS_KEY, enabled);
          }}
        >
          <MenuItem id={MUTATIONS_KEY} textValue="Dangerously enable mutations">
            Dangerously enable mutations
          </MenuItem>
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
