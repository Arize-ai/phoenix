import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import { useCallback, useRef, useState } from "react";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components";
import type { CopyItem } from "@phoenix/hooks/useMatchesWithCrumb";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export function NavCopyActionMenu({ items }: { items: CopyItem[] }) {
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

  const icon =
    copiedItemId != null ? <Icons.Checkmark /> : <Icons.DuplicateOutline />;

  return (
    <MenuTrigger>
      <Button
        size="S"
        variant="quiet"
        aria-label="Copy"
        leadingVisual={<Icon svg={icon} />}
        className="nav-copy-action-menu__button"
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
              leadingContent={<Icon svg={<Icons.DuplicateOutline />} />}
            >
              {item.name}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
