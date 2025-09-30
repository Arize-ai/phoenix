import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  MenuTrigger as AriaMenuTrigger,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames, Icon, Icons } from "@phoenix/components";

const menuCss = css`
  &[data-empty] {
    align-items: center;
    justify-content: center;
    display: flex;
    padding: var(--ac-global-dimension-static-size-100);
  }
`;

export const MenuTrigger = AriaMenuTrigger;

export const Menu = <T extends object>({
  className,
  ...props
}: AriaMenuProps<T>) => {
  return (
    <AriaMenu
      className={classNames("react-aria-Menu", className)}
      css={menuCss}
      {...props}
    />
  );
};

const menuItemCss = css`
  margin: var(--ac-global-dimension-static-size-100);
  padding: var(--ac-global-dimension-static-size-100) var(--ac-global-dimension-static-size-200);
  border-radius: var(--ac-global-rounding-small);
  outline: none;
  cursor: default;
  color: var(--ac-global-text-color-900);
  position: relative;
  display: flex;
  gap: var(--ac-global-dimension-static-size-100);
  align-items: center;

  &[data-selected] {
    background-color: var(--ac-highlight-background);
    color: var(--ac-highlight-foreground);
    i {
      color: var(--ac-global-color-primary);
    }
  }

  &[data-open],
  &[data-focused],
  &[data-hovered] {
    background-color: var(--ac-global-menu-item-background-color-hover);
  }

  &[data-disabled] {
    cursor: not-allowed;
    color: var(--ac-global-color-text-300);
  }

  &[data-focus-visible] {
    outline: none;
  }

 & svg {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
  }
}

@media (forced-colors: active) {
  &[data-focused] {
    forced-color-adjust: none;
    background: Highlight;
    color: HighlightText;
  }
`;

export const MenuItem = <T extends object>({
  className,
  ...props
}: AriaMenuItemProps<T>) => {
  const textValue =
    props.textValue ||
    (typeof props.children === "string" ? props.children : undefined);
  return (
    <AriaMenuItem
      {...props}
      css={menuItemCss}
      className={classNames("react-aria-MenuItem", className)}
      textValue={textValue}
    >
      {({ hasSubmenu, isSelected }) => {
        return (
          <>
            {props.children}
            {isSelected && <Icon svg={<Icons.Checkmark />} />}
            {hasSubmenu && <Icon svg={<Icons.ChevronRight />} />}
          </>
        );
      }}
    </AriaMenuItem>
  );
};
