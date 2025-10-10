import { CSSProperties, PropsWithChildren, ReactNode } from "react";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  MenuTrigger as AriaMenuTrigger,
  PopoverProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import {
  classNames,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  Popover,
} from "@phoenix/components";

const menuCss = css`
  --menu-min-width: 250px;
  min-width: var(--menu-min-width);
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--ac-global-dimension-static-size-50);
  &:focus-visible {
    border-radius: var(--ac-global-rounding-small);
    outline: 2px solid var(--ac-global-color-primary);
    outline-offset: 0px;
  }
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
}: AriaMenuProps<T> & { width?: CSSProperties["width"] }) => {
  return (
    <AriaMenu
      className={classNames("react-aria-Menu", className)}
      css={menuCss}
      style={{
        width: props.width,
        minWidth: props.width,
        maxWidth: props.width,
      }}
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
  justify-content: space-between;

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

export const MenuContainer = ({
  children,
  maxHeight = 600,
  placement = "bottom end",
  ...popoverProps
}: PropsWithChildren & { maxHeight?: number } & Omit<
    PopoverProps,
    "maxHeight"
  >) => {
  return (
    <Popover
      shouldFlip={false}
      placement={placement}
      containerPadding={-4}
      {...popoverProps}
    >
      <div
        style={{
          maxHeight,
        }}
        css={css`
          min-height: 300px;
          display: flex;
          flex-direction: column;
          height: 100%;
        `}
      >
        {children}
      </div>
    </Popover>
  );
};

export const MenuHeader = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-static-size-100);
        border-bottom: 1px solid var(--ac-global-menu-border-color);
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        gap: var(--ac-global-dimension-static-size-100);
      `}
    >
      {children}
    </div>
  );
};

export const MenuHeaderTitle = ({
  children,
  leadingContent,
  trailingContent,
}: PropsWithChildren & {
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
}) => {
  return (
    <Flex
      direction="row"
      gap="size-50"
      alignItems="center"
      wrap="nowrap"
      minHeight={30}
    >
      {leadingContent}
      <Heading
        level={4}
        weight="heavy"
        css={css`
          flex: 1 1 auto;
          width: 100%;
        `}
      >
        {children}
      </Heading>
      {trailingContent}
    </Flex>
  );
};

export const MenuFooter = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-static-size-100);
        border-top: 1px solid var(--ac-global-menu-border-color);
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        gap: var(--ac-global-dimension-static-size-50);
      `}
    >
      {children}
    </div>
  );
};

export const MenuTriggerPlaceholder = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <Text
      color="grey-400"
      fontStyle="italic"
      css={css`
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `}
    >
      {children}
    </Text>
  );
};
