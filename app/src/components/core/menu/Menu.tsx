import { css } from "@emotion/react";
import type { KeyboardEvent, PropsWithChildren, ReactNode } from "react";
import type { PopoverProps } from "react-aria-components";
import {
  Header,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  MenuTrigger as AriaMenuTrigger,
} from "react-aria-components";

import { classNames } from "@phoenix/utils/classNames";

import { Heading, Text } from "../content";
import { Icon, Icons } from "../icon";
import { Flex } from "../layout";
import { Popover } from "../overlay";

const menuCSS = css`
  --menu-min-width: 250px;
  min-width: var(--menu-min-width);
  display: flex;
  flex-direction: column;
  gap: var(--global-menu-item-gap);
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--global-menu-item-gap);
  /* The menu container itself takes focus when opened before focus moves to an
     item. Suppress the container-level focus ring — keyboard focus is already
     indicated on the focused item — so the whole menu doesn't get outlined. */
  &:focus-visible {
    outline: none;
  }
  &[data-empty] {
    align-items: center;
    justify-content: center;
    display: flex;
    padding: var(--global-dimension-size-100);
  }

  .react-aria-MenuSection {
    display: flex;
    flex-direction: column;
    gap: var(--global-menu-item-gap);
  }
`;

/**
 * A trigger that opens a menu.
 * This is the root most component when creating a menu.
 * @see https://react-spectrum.adobe.com/react-aria/MenuTrigger.html
 */
export const MenuTrigger = AriaMenuTrigger;

/**
 * A menu is a list of items that can be selected.
 * This is the container for the menu items, and should be used in conjunction with MenuTrigger and MenuContainer.
 * @see https://react-spectrum.adobe.com/react-aria/Menu.html
 * @example
 * <MenuTrigger>
 *   <Button>Open Menu</Button>
 *   <MenuContainer>
 *     <Menu>
 *       <MenuItem>Item 1</MenuItem>
 *       <MenuItem>Item 2</MenuItem>
 *       <MenuItem>Item 3</MenuItem>
 *     </Menu>
 *   </MenuContainer>
 * </MenuTrigger>
 */
/**
 * React Aria's MenuProps intentionally omits keyboard events from its type
 * surface, but the underlying DOM element supports them. This extended type
 * allows consumers to respond to key presses (e.g. Delete to remove an item)
 * without wrapping the menu in extra DOM elements.
 */
type MenuKeyboardProps = {
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
};

export const Menu = <T extends object>({
  className,
  onKeyDown,
  ...props
}: AriaMenuProps<T> & MenuKeyboardProps) => {
  return (
    <AriaMenu
      className={classNames("react-aria-Menu", className)}
      css={menuCSS}
      {...props}
      // @ts-expect-error onKeyDown is not in AriaMenuProps but is valid on the rendered div
      onKeyDown={onKeyDown}
    />
  );
};

const menuItemCss = css`
  padding: var(--global-dimension-size-50);
  border-radius: var(--global-rounding-small);
  outline: none;
  cursor: default;
  color: var(--global-text-color-900);
  text-decoration: none;
  position: relative;
  display: flex;

  align-items: center;
  justify-content: space-between;

  &[data-open],
  &[data-focused],
  &[data-hovered] {
    background-color: var(--global-menu-item-background-color-hover);
  }

  &[data-disabled] {
    cursor: not-allowed;
    color: var(--global-color-text-300);
    opacity: var(--global-opacity-disabled);
  }

  &[data-focus-visible] {
    outline: none;
  }

  @media (forced-colors: active) {
    &[data-focused] {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }
  }
`;

/**
 * A menu item is a single item in a menu.
 * This is the individual item that can be selected.
 * It can also be rendered inside of a render function for a menu, this pattern is more common.
 * @see https://react-spectrum.adobe.com/react-aria/MenuItem.html
 * @example
 * <Menu>
 *   <MenuContainer>
 *     <Menu>
 *       <MenuItem>Item 1</MenuItem>
 *       <MenuItem>Item 2</MenuItem>
 *       <MenuItem>Item 3</MenuItem>
 *     </Menu>
 *   </MenuContainer>
 * </Menu>
 */
export const MenuItem = <T extends object>({
  className,
  trailingContent,
  leadingContent,
  ...props
}: AriaMenuItemProps<T> & {
  trailingContent?: ReactNode;
  leadingContent?: ReactNode;
}) => {
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
      {(renderProps) => {
        const { hasSubmenu, isSelected, selectionMode } = renderProps;
        return (
          <>
            {isSelected && <Icon svg={<Icons.Checkmark />} />}
            {selectionMode !== "none" && !isSelected && (
              <Icon
                svg={<Icons.Checkmark />}
                css={css`
                  visibility: hidden;
                `}
              />
            )}
            <MenuItemContent
              trailingContent={trailingContent}
              leadingContent={leadingContent}
            >
              {typeof props.children === "function"
                ? props.children(renderProps)
                : props.children}
            </MenuItemContent>
            {/* TODO: this doesn't have a good way to reserve space for the chevron
            in menus where only some items are nestable */}
            {hasSubmenu && <Icon svg={<Icons.ChevronRightSmall />} />}
          </>
        );
      }}
    </AriaMenuItem>
  );
};

const MenuItemContent = ({
  children,
  trailingContent,
  leadingContent,
}: {
  children: ReactNode;
  trailingContent?: ReactNode;
  leadingContent?: ReactNode;
}) => {
  return (
    <Flex
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap="var(--global-menu-split-item-content-gap)"
      minWidth={0}
      flex={1}
      css={css`
        padding: var(--global-menu-item-gap);
      `}
    >
      {leadingContent ? (
        <Flex alignItems="center" gap="var(--global-menu-item-content-gap)">
          {leadingContent} {children}
        </Flex>
      ) : (
        children
      )}
      {trailingContent}
    </Flex>
  );
};

const menuContainerCss = css`
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
`;

/**
 * A menu container is a container for a menu.
 * This is the container for the menu items, and should be used in conjunction with MenuTrigger and Menu.
 * It includes a popover, as well as height, padding, and other styling.
 * @see https://react-spectrum.adobe.com/react-aria/MenuContainer.html
 * @example
 * <MenuTrigger>
 *   <Button>Open Menu</Button>
 *   <MenuContainer>
 *     <Menu>
 *       <MenuItem>Item 1</MenuItem>
 *       <MenuItem>Item 2</MenuItem>
 *       <MenuItem>Item 3</MenuItem>
 *     </Menu>
 *   </MenuContainer>
 * </MenuTrigger>
 */
export const MenuContainer = ({
  children,
  placement = "bottom end",
  minHeight = "var(--global-menu-min-height)",
  maxHeight = "var(--global-menu-max-height-large)",
  maxWidth = 450,
  ...popoverProps
}: PropsWithChildren &
  Omit<PopoverProps, "maxHeight" | "maxWidth"> & {
    minHeight?: React.CSSProperties["minHeight"];
    maxHeight?: React.CSSProperties["maxHeight"];
    maxWidth?: React.CSSProperties["maxWidth"];
  }) => {
  return (
    <Popover
      shouldFlip={false}
      placement={placement}
      css={menuContainerCss}
      {...popoverProps}
    >
      <div
        style={{ minHeight, maxHeight, maxWidth }}
        css={css`
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 300px;
        `}
      >
        {children}
      </div>
    </Popover>
  );
};

const menuSectionTitleCss = css`
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100) 0;
`;

export const MenuSectionTitle = ({
  title,
  trailingContent,
}: {
  title: string;
  trailingContent?: ReactNode;
}) => {
  return (
    <Header css={menuSectionTitleCss}>
      <Flex justifyContent="space-between" alignItems="center">
        <Text weight="heavy">{title}</Text>
        {trailingContent}
      </Flex>
    </Header>
  );
};
/**
 * A menu header is a header for a menu.
 * This is the header for the menu, and should be used in conjunction with MenuTrigger and MenuContainer.
 * It includes a border and flexbox layout. Children are responsible for their own padding.
 * It is typically placed above a sibling Menu component.
 * @see https://react-spectrum.adobe.com/react-aria/MenuHeader.html
 * @example
 * <MenuTrigger>
 *   <Button>Open Menu</Button>
 *   <MenuContainer>
 *     <MenuHeader>
 *       <MenuHeaderTitle>Menu Header</MenuHeaderTitle>
 *     </MenuHeader>
 *     <Menu>
 *       <MenuItem>Item 1</MenuItem>
 *       <MenuItem>Item 2</MenuItem>
 *       <MenuItem>Item 3</MenuItem>
 *     </Menu>
 *   </MenuContainer>
 * </MenuTrigger>
 */
export const MenuHeader = ({ children }: PropsWithChildren) => {
  return (
    <div
      className="menu-header"
      css={css`
        display: flex;
        flex-direction: column;
        flex-shrink: 0;

        /* Draw the divider under (and, when stacked, between) quiet
           SearchFields in the header by re-coloring the field's own border.
           Scope with the block class (&.menu-header ...) so this wins over the
           quiet variant's border resets in EVERY interaction state — rest,
           hover, and focus. Without the extra specificity the variant's
           :focused reset ties on specificity and wins on source order, so a
           focused (e.g. autoFocused) search field silently loses its divider.
           Invalid fields keep their danger border. */
        &.menu-header
          .search-field[data-variant="quiet"]
          .react-aria-Input:not([data-invalid]) {
          border-bottom-color: var(--global-menu-border-color);
        }
        &.menu-header
          *
          + .search-field[data-variant="quiet"]
          .react-aria-Input:not([data-invalid]) {
          border-top-color: var(--global-menu-border-color);
        }
      `}
    >
      {children}
    </div>
  );
};

/**
 * A menu header title is a title for a menu header.
 * This is the title for the menu header, and should be used in conjunction with MenuHeader.
 * It can be configured with optional leading and trailing content.
 * @see https://react-spectrum.adobe.com/react-aria/MenuHeaderTitle.html
 * @example
 * <MenuHeader>
 *   <MenuHeaderTitle
 *     leadingContent={<Icon svg={<Icons.Search />} />}
 *     trailingContent={<Button leadingVisual={<Icon svg={<Icons.Close />} />} />}
 *   >
 *     Menu Header
 *   </MenuHeaderTitle>
 * </MenuHeader>
 */
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
      data-testid="menu-header-title"
      css={css`
        padding: var(--global-dimension-size-100);
        border-bottom: 1px solid var(--global-menu-border-color);
      `}
    >
      {leadingContent}
      <Heading
        level={4}
        weight="heavy"
        css={css`
          flex: 1 1 auto;
          width: 100%;
          padding-left: var(--global-dimension-size-50);
        `}
      >
        {children}
      </Heading>
      {trailingContent}
    </Flex>
  );
};

/**
 * A menu footer is a footer for a menu.
 * This is the footer for the menu, and should be used in conjunction with MenuTrigger and MenuContainer.
 * It is typically placed below a sibling Menu component.
 * @see https://react-spectrum.adobe.com/react-aria/MenuFooter.html
 * @example
 * <MenuTrigger>
 *   <Button>Open Menu</Button>
 *   <MenuContainer>
 *     <Menu>
 *       <MenuItem>Item 1</MenuItem>
 *       <MenuItem>Item 2</MenuItem>
 *       <MenuItem>Item 3</MenuItem>
 *     </Menu>
 *     <MenuFooter>
 *       <Button>Clear</Button>
 *     </MenuFooter>
 *   </MenuContainer>
 * </MenuTrigger>
 */
export const MenuFooter = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        padding: var(--global-dimension-size-100);
        border-top: 1px solid var(--global-menu-border-color);
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        gap: var(--global-dimension-size-50);
      `}
    >
      {children}
    </div>
  );
};

/**
 * A menu trigger placeholder is a placeholder for a menu trigger.
 * This is the placeholder for the menu trigger, and should be used in conjunction with MenuTrigger.
 * @see https://react-spectrum.adobe.com/react-aria/MenuTriggerPlaceholder.html
 * @example
 * <MenuTrigger>
 *   <Button>{
 *     selectedItems.length > 0
 *     ? selectedItems.join(", ")
 *     : <MenuTriggerPlaceholder>Select items</MenuTriggerPlaceholder>
 *   }</Button>
 * </MenuTrigger>
 */
export const MenuTriggerPlaceholder = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <Text
      color="gray-400"
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
