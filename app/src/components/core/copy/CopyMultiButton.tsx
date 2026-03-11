import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { Key } from "react";
import { useCallback, useState } from "react";

import type { ButtonProps } from "../button";
import { Button } from "../button";
import { Icon, Icons } from "../icon";
import { Menu, MenuItem, MenuTrigger } from "../menu";
import { Popover } from "../overlay";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export interface CopyMultiButtonItem {
  /** Unique key for the item. */
  key: string;
  /** Display label shown in the dropdown. */
  label: string;
  /** The text to copy when this item is selected. */
  text: string;
}

export interface CopyMultiButtonProps {
  /**
   * The copy targets to display in the dropdown.
   */
  items: CopyMultiButtonItem[];
  /**
   * The size of the button.
   * @default "S"
   */
  size?: ButtonProps["size"];
}

const multiButtonCSS = css`
  flex: none;
  box-sizing: content-box;
`;

const chevronCSS = css`
  font-size: 0.85em;
`;

const compactMenuCSS = css`
  --menu-min-width: 180px;
`;

/**
 * A labeled "Copy" button with a dropdown caret that opens a menu of copy
 * targets. The button itself reads "Copy" and the menu items identify *what*
 * is being copied (e.g. "Span ID", "Trace ID"). After selecting an item the
 * button icon briefly shows a checkmark.
 */
export function CopyMultiButton({ items, size = "S" }: CopyMultiButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const onAction = useCallback(
    (key: Key) => {
      const item = items.find((i) => i.key === String(key));
      if (item) {
        copy(item.text);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, SHOW_COPIED_TIMEOUT_MS);
      }
    },
    [items]
  );

  return (
    <div className="copy-multi-button" css={multiButtonCSS}>
      <MenuTrigger>
        <Button
          size={size}
          leadingVisual={
            <Icon
              svg={isCopied ? <Icons.Checkmark /> : <Icons.ClipboardCopy />}
            />
          }
          trailingVisual={<Icon svg={<Icons.ChevronDown />} css={chevronCSS} />}
        >
          Copy
        </Button>
        <Popover placement="bottom start">
          <Menu onAction={onAction} css={compactMenuCSS}>
            {items.map((item) => (
              <MenuItem key={item.key} id={item.key} textValue={item.label}>
                {item.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
}
