import { PropsWithChildren, ReactNode } from "react";
import {
  Header,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  MenuTrigger as AriaMenuTrigger,
  PopoverProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Flex, Heading, Icon, Icons, Popover, Text } from "@phoenix/components";
import { classNames } from "@phoenix/utils";

const menuCss = css`
  --menu-min-width: 250px;
  min-width: var(--menu-min-width);
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-menu-item-gap);
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--ac-global-menu-item-gap);
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

  .react-aria-MenuSection {
    display: flex;
    flex-direction: column;
    gap: var(--ac-global-menu-item-gap);
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
  padding: var(--ac-global-dimension-static-size-50);
  border-radius: var(--ac-global-rounding-small);
  outline: none;
  cursor: default;
  color: var(--ac-global-text-color-900);
  position: relative;
  display: flex;
  gap: var(--ac-global-dimension-static-size-50);
  align-items: center;
  justify-content: space-between;

  &[data-open],
  &[data-focused],
  &[data-hovered] {
    background-color: var(--ac-global-menu-item-background-color-hover);
  }

  &[data-disabled] {
    cursor: not-allowed;
    color: var(--ac-global-color-text-300);
    opacity: var(--ac-global-opacity-disabled);
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
  ...props
}: AriaMenuItemProps<T> & { trailingContent?: ReactNode }) => {
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
            {selectionMode === "multiple" && !isSelected && (
              <Icon
                svg={<Icons.CheckmarkOutline />}
                css={css`
                  visibility: hidden;
                `}
              />
            )}
            <MenuItemContent trailingContent={trailingContent}>
              {typeof props.children === "function"
                ? props.children(renderProps)
                : props.children}
            </MenuItemContent>
            {/* TODO: this doesn't have a good way to reserve space for the chevron 
            in menus where only some items are nestable */}
            {hasSubmenu && <Icon svg={<Icons.ChevronRight />} />}
          </>
        );
      }}
    </AriaMenuItem>
  );
};

const MenuItemContent = ({
  children,
  trailingContent,
}: {
  children: ReactNode;
  trailingContent?: ReactNode;
}) => {
  return (
    <Flex
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap="var(--ac-global-menu-split-item-content-gap)"
      minWidth={0}
      flex={1}
      css={css`
        padding: var(--ac-global-menu-item-gap);
      `}
    >
      {children}
      {trailingContent}
    </Flex>
  );
};

const menuContainerCss = css`
  overflow-y: hidden;
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
  ...popoverProps
}: PropsWithChildren & Omit<PopoverProps, "maxHeight" | "maxWidth">) => {
  return (
    <Popover
      shouldFlip={false}
      placement={placement}
      css={menuContainerCss}
      {...popoverProps}
    >
      <div
        css={css`
          min-height: 300px;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 300px;
          max-height: inherit;
        `}
      >
        {children}
      </div>
    </Popover>
  );
};

const menuSectionTitleCss = css`
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100) 0;
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
 * It includes a padding, border, and flexbox layout.
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
