import { css } from "@emotion/react";
import type { ReactNode } from "react";
import type { MenuItemProps as AriaMenuItemProps } from "react-aria-components";

import { MenuItem } from "@phoenix/components/core/menu";

const commandPaletteItemCSS = css`
  .command-palette-item__layout {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    flex: 1 1 auto;
  }

  .command-palette-item__icon {
    display: flex;
    align-items: center;
    flex: none;
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-m);
  }

  .command-palette-item__label {
    flex: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }

  .command-palette-item__description {
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-s);
  }
`;

export interface CommandPaletteItemProps extends Omit<
  AriaMenuItemProps,
  "children" | "className" | "style"
> {
  /**
   * A leading visual, e.g. an <Icon />
   */
  icon?: ReactNode;
  /**
   * Secondary text shown dimmed after the label, truncated to one line
   */
  description?: ReactNode;
  /**
   * The primary label content
   */
  children: ReactNode;
  /**
   * Plain-text equivalent of the label, used for typeahead, filtering, and
   * assistive technology. Required because the label may contain markup
   * (e.g. match highlighting).
   */
  textValue: string;
}

/**
 * A single result or command inside a CommandPalette, with an optional icon
 * and dimmed one-line description.
 */
export function CommandPaletteItem({
  icon,
  description,
  children,
  ...props
}: CommandPaletteItemProps) {
  return (
    <MenuItem
      {...props}
      className="command-palette-item"
      css={commandPaletteItemCSS}
    >
      <div className="command-palette-item__layout">
        {icon && <span className="command-palette-item__icon">{icon}</span>}
        <span className="command-palette-item__label">{children}</span>
        {description && (
          <span className="command-palette-item__description">
            {description}
          </span>
        )}
      </div>
    </MenuItem>
  );
}
