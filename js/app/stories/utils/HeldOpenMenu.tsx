import type { ComponentProps, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MenuStateContext,
  RootMenuTriggerStateContext,
} from "react-aria-components";
import { useMenuTriggerState } from "react-stately";

import { Menu, MenuContainer, MenuTrigger } from "@phoenix/components";

import { HeldOpenCell } from "./HeldOpenCell";

const noop = () => {};

export const HELD_OPEN_MENU_WIDTH = 320;

type ContainerProps = Omit<
  ComponentProps<typeof MenuContainer>,
  "children" | "trigger" | "triggerRef" | "isOpen"
>;

type HeldOpenMenuProps = {
  /** A function receives the boundary a held-open submenu positions against. */
  children: ReactNode | ((boundaryElement: Element) => ReactNode);
  /** The room the open menu takes. */
  height: number;
  width?: number;
} & ContainerProps;

/**
 * A `MenuContainer` held open at the top of a `HeldOpenCell`, with no
 * trigger: it is anchored to an empty point, so only the menu's surface and
 * content show. Pressing an item, Escape or the page around it does not
 * close it.
 */
export function HeldOpenMenu({
  children,
  height,
  width = HELD_OPEN_MENU_WIDTH,
  ...containerProps
}: HeldOpenMenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <HeldOpenCell width={width} height={height}>
      {(boundaryElement) => (
        <>
          <div ref={anchorRef} />
          <MenuContainer
            isOpen
            triggerRef={anchorRef}
            placement="bottom start"
            offset={0}
            shouldFlip={false}
            closeOnInteractOutside={false}
            boundaryElement={boundaryElement}
            {...containerProps}
          >
            {typeof children === "function"
              ? children(boundaryElement)
              : children}
          </MenuContainer>
        </>
      )}
    </HeldOpenCell>
  );
}

type HeldOpenTriggeredMenuProps = HeldOpenMenuProps & {
  triggerButton: ReactNode;
  /** Where the trigger sits in its cell, so the menu has room to open. */
  triggerAlign?: "start" | "end";
  triggerAtBottom?: boolean;
};

/**
 * A menu held open beside its trigger, for a story about where a menu opens
 * relative to the trigger.
 */
export function HeldOpenTriggeredMenu({
  children,
  height,
  width = HELD_OPEN_MENU_WIDTH,
  triggerButton,
  triggerAlign = "end",
  triggerAtBottom = false,
  ...containerProps
}: HeldOpenTriggeredMenuProps) {
  return (
    <HeldOpenCell
      width={width}
      height={height}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: triggerAlign === "end" ? "flex-end" : "flex-start",
        justifyContent: triggerAtBottom ? "flex-end" : "flex-start",
      }}
    >
      {(boundaryElement) => (
        <MenuTrigger isOpen onOpenChange={noop}>
          {triggerButton}
          <MenuContainer
            closeOnInteractOutside={false}
            boundaryElement={boundaryElement}
            {...containerProps}
          >
            {typeof children === "function"
              ? children(boundaryElement)
              : children}
          </MenuContainer>
        </MenuTrigger>
      )}
    </HeldOpenCell>
  );
}

/** A held-open menu's `Menu` must not take focus: every one mounts at once. */
export function HeldOpenList<T extends object>(
  props: ComponentProps<typeof Menu<T>>
) {
  return <Menu<T> autoFocus={false} {...props} />;
}

const HoldSubmenuContext = createContext<(triggerKey: string) => void>(noop);

/**
 * Holds a submenu open, the way `isOpen` holds the root menu.
 * `SubmenuTrigger` has no open prop: it reads whether its submenu is open from
 * the root menu's trigger state, which this provides with closing ignored. Put
 * a `HoldSubmenuOpen` inside the item that triggers the submenu to open it.
 */
export function HeldOpenSubmenus({ children }: { children: ReactNode }) {
  const ownState = useMenuTriggerState({ isOpen: true });
  const state = useContext(RootMenuTriggerStateContext) ?? ownState;
  const [expandedKeysStack, setExpandedKeysStack] = useState<string[]>([]);
  const hold = useCallback(
    (triggerKey: string) => setExpandedKeysStack([triggerKey]),
    []
  );
  const heldState = useMemo(
    () => ({
      ...state,
      expandedKeysStack,
      closeSubmenu: noop,
      close: noop,
    }),
    [state, expandedKeysStack]
  );
  return (
    <HoldSubmenuContext.Provider value={hold}>
      <RootMenuTriggerStateContext.Provider value={heldState}>
        {children}
      </RootMenuTriggerStateContext.Provider>
    </HoldSubmenuContext.Provider>
  );
}

/**
 * A submenu takes its level from how many submenus are open when it first
 * renders, and a menu renders its items after its own first render, so the
 * submenu is opened from inside its trigger item, once that item exists.
 */
export function HoldSubmenuOpen({ itemId }: { itemId: string }) {
  const hold = useContext(HoldSubmenuContext);
  const menuState = useContext(MenuStateContext);
  // A submenu is keyed by its SubmenuTrigger's generated collection key, not
  // by the trigger item's id or React key, so read it from the item's parent.
  const triggerKey = menuState?.collection.getItem(itemId)?.parentKey;
  useEffect(() => {
    if (triggerKey != null) {
      hold(String(triggerKey));
    }
  }, [hold, triggerKey]);
  return null;
}
