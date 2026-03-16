import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import type { CopyItem } from "@phoenix/hooks/useMatchesWithCrumb";

import { Button, IconButton } from "../button";
import type { ButtonProps } from "../button";
import { Icon, Icons } from "../icon";
import { Menu, MenuItem, MenuTrigger } from "../menu";
import { Popover } from "../overlay";

export type { CopyItem as CopyMultiButtonItem };

const SHOW_COPIED_TIMEOUT_MS = 2000;

export interface CopyMultiButtonProps {
  /**
   * The copy targets to display in the dropdown menu.
   */
  items: CopyItem[];
  /**
   * Visual style of the trigger button.
   * - `"quiet"` (default): borderless icon-only button
   * - `"default"`: bordered button matching standard input field chrome
   */
  variant?: "quiet" | "default";
  /**
   * The size of the trigger button.
   * @default "S"
   */
  size?: ButtonProps["size"];
  /**
   * CSS class applied to the outermost wrapper element, useful for
   * parent-driven visibility toggling (e.g. show-on-hover patterns).
   */
  className?: string;
}

const compactMenuCSS = css`
  --menu-min-width: auto;
`;

function getItemIcon(name: string): ReactNode {
  const lower = name.toLowerCase();
  if (lower.includes("id")) {
    return <Icons.EntityId />;
  }
  if (lower.includes("content")) {
    return <Icons.BlockJSON />;
  }
  if (lower.includes("name")) {
    return <Icons.EntityTitle />;
  }
  return <Icons.DuplicateOutline />;
}

/**
 * An icon-only copy button that opens a dropdown menu of copy targets.
 * Each item is prefixed with "Copy" and shows an entity icon based on the
 * item name. After selecting an item the trigger icon briefly shows a
 * checkmark.
 */
export function CopyMultiButton({
  items,
  variant = "quiet",
  size = "S",
  className,
}: CopyMultiButtonProps) {
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onAction = useCallback(
    (key: React.Key) => {
      const item = items.find((i) => i.name === key);
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

  const iconSvg =
    copiedItemId != null ? <Icons.Checkmark /> : <Icons.DuplicateOutline />;

  const trigger =
    variant === "default" ? (
      <Button
        size={size}
        leadingVisual={<Icon svg={iconSvg} />}
        aria-label="Copy"
      />
    ) : (
      <IconButton size={size} aria-label="Copy">
        <Icon svg={iconSvg} />
      </IconButton>
    );

  return (
    <div className={className} data-copied={copiedItemId != null || undefined}>
      <MenuTrigger>
        {trigger}
        <Popover placement="bottom start" offset={3}>
          <Menu onAction={onAction} css={compactMenuCSS}>
            {items.map((item) => (
              <MenuItem
                key={item.name}
                id={item.name}
                textValue={`Copy ${item.name}`}
                leadingContent={<Icon svg={getItemIcon(item.name)} />}
              >
                Copy {item.name}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
}
