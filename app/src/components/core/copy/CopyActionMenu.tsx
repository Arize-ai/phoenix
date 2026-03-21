import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import { useCallback, useRef, useState } from "react";

import { Button } from "../button";
import { Icon } from "../icon";
import { Menu, MenuItem, MenuTrigger } from "../menu";
import { Popover } from "../overlay";
import type { CopyActionMenuItem } from "./types";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export interface CopyActionMenuProps {
  /**
   * The items to display in the copy action menu.
   */
  items: CopyActionMenuItem[];
}

/**
 * A menu button that presents a list of copyable items.
 * Each item copies its value to the clipboard when selected.
 */
export function CopyActionMenu({ items }: CopyActionMenuProps) {
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onAction = useCallback(
    (key: React.Key) => {
      const item = items.find((item) => item.name === key);
      if (!item) return;
      copy(item.value);
      setCopiedItemId(item.name);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopiedItemId(null);
      }, SHOW_COPIED_TIMEOUT_MS);
    },
    [items]
  );

  const iconKey = copiedItemId != null ? "Checkmark" : "DuplicateOutline";

  return (
    <MenuTrigger>
      <Button
        size="S"
        variant="quiet"
        aria-label="Copy"
        leadingVisual={
          <Icon
            svgKey={iconKey}
            color={copiedItemId != null ? "success" : "inherit"}
          />
        }
        className="copy-action-menu__button"
        data-copied={copiedItemId != null || undefined}
      >
        {copiedItemId != null ? "Copied" : undefined}
      </Button>
      <Popover placement="bottom end" offset={3}>
        <Menu
          onAction={onAction}
          css={css`
            --menu-min-width: auto;
          `}
        >
          {items.map((item) => (
            <MenuItem
              key={item.name}
              id={item.name}
              textValue={`Copy ${item.name}`}
              leadingContent={
                <Icon svgKey={item.iconKey ?? "DuplicateOutline"} />
              }
            >
              {item.name}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
