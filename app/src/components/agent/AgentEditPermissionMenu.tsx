import { css } from "@emotion/react";
import { MenuSection } from "react-aria-components";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  Text,
  VisuallyHidden,
} from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentEditPermissionMode } from "@phoenix/store";

type EditPermissionModeMeta = {
  mode: AgentEditPermissionMode;
  label: string;
  description: string;
};

/**
 * Available edit-permission modes in the order they appear in the menu. This
 * ordering also drives the `Ctrl+T` hotkey cycle so the keyboard shortcut and
 * the popover stay in sync.
 */
export const EDIT_PERMISSION_MODES: readonly EditPermissionModeMeta[] = [
  {
    mode: "manual",
    label: "Manual Approval",
    description: "PXI asks before applying edits",
  },
  {
    mode: "bypass",
    label: "Bypass Approval",
    description: "Edits are applied without asking",
  },
] as const;

const EDIT_PERMISSION_MODE_BY_KEY = new Map(
  EDIT_PERMISSION_MODES.map((meta) => [meta.mode, meta])
);

export function getEditPermissionLabel(mode: AgentEditPermissionMode): string {
  return EDIT_PERMISSION_MODE_BY_KEY.get(mode)?.label ?? mode;
}

/**
 * Returns the mode that follows `mode` in menu order, wrapping around to the
 * first entry. Used by the `Ctrl+T` hotkey to cycle through the modes in the
 * same order they appear in the popover.
 */
export function getNextEditPermissionMode(
  mode: AgentEditPermissionMode
): AgentEditPermissionMode {
  const currentIndex = EDIT_PERMISSION_MODES.findIndex(
    (meta) => meta.mode === mode
  );
  const nextIndex = (currentIndex + 1) % EDIT_PERMISSION_MODES.length;
  return EDIT_PERMISSION_MODES[nextIndex].mode;
}

const triggerCSS = css`
  /* Quiet, borderless rest state. */
  gap: var(--global-dimension-size-50);
  color: var(--global-text-color-300);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);

  .theme--light & {
    color: var(--global-text-color-500);
  }

  /* Surface a warning treatment when approvals are bypassed. */
  &[data-permission-mode="bypass"] {
    color: var(--global-color-warning);
  }

  /* Menu close returns focus to trigger; suppress outline for mouse interactions */
  &[data-focused]:not([data-focus-visible]) {
    outline: none;
  }
`;

const menuCSS = css`
  min-width: 320px;
`;

const menuItemCSS = css`
  .agent-edit-permission-item__description {
    white-space: normal;
  }
`;

/**
 * Borderless edit-permission selector for the agent prompt input.
 *
 * Renders a quiet trigger that opens a popover listing the available approval
 * modes, each with a short description. The active mode is the selected menu
 * item. The `Ctrl+T` hotkey (handled by the parent) cycles modes in the same
 * order shown here.
 */
export function AgentEditPermissionMenu({
  isDisabled,
}: {
  isDisabled?: boolean;
}) {
  const editPermissionMode = useAgentContext(
    (state) => state.permissions.edits
  );
  const setPermissions = useAgentContext((state) => state.setPermissions);
  const isBypass = editPermissionMode === "bypass";

  return (
    <MenuTrigger>
      <Button
        aria-label={`Edit permission: ${getEditPermissionLabel(editPermissionMode)}. Press Control T to cycle.`}
        size="S"
        variant="quiet"
        isDisabled={isDisabled}
        css={triggerCSS}
        data-permission-mode={editPermissionMode}
        leadingVisual={isBypass ? <Icon svg={<Icons.Shield />} /> : undefined}
      >
        <span>{getEditPermissionLabel(editPermissionMode)}</span>
      </Button>
      <MenuContainer placement="top start" minHeight="auto" shouldFlip>
        <Menu
          css={menuCSS}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[editPermissionMode]}
          onSelectionChange={(keys) => {
            if (keys === "all") {
              return;
            }
            const [next] = keys;
            if (typeof next === "string") {
              setPermissions({ edits: next as AgentEditPermissionMode });
            }
          }}
        >
          <MenuSection>
            <MenuSectionTitle
              title="Edit Approvals"
              trailingContent={
                <Keyboard>
                  <VisuallyHidden>Press Control T to cycle</VisuallyHidden>
                  <span aria-hidden="true">Ctrl T</span>
                </Keyboard>
              }
            />
            {EDIT_PERMISSION_MODES.map((meta) => (
              <MenuItem
                key={meta.mode}
                id={meta.mode}
                textValue={`${meta.label}\n${meta.description}`}
                css={menuItemCSS}
              >
                <Flex direction="column" gap="size-25">
                  <Text weight="heavy">{meta.label}</Text>
                  <Text
                    size="XS"
                    color="text-700"
                    className="agent-edit-permission-item__description"
                  >
                    {meta.description}
                  </Text>
                </Flex>
              </MenuItem>
            ))}
          </MenuSection>
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
