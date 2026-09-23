import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { Button } from "../../button";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  resolveMenuContainerOverlayProps,
} from "../Menu";

describe("resolveMenuContainerOverlayProps", () => {
  it("defaults a root menu below its trigger with flipping", () => {
    expect(
      resolveMenuContainerOverlayProps({
        placement: undefined,
        shouldFlip: undefined,
        isSubmenu: false,
      })
    ).toEqual({ placement: "bottom end", shouldFlip: true });
  });

  it("leaves a submenu on React Aria's side placement with flipping", () => {
    // Forcing a submenu below its trigger item dooms the pointer to cross
    // sibling items on its way to the submenu, closing it before it can be
    // used. The context default ("end top") must win.
    expect(
      resolveMenuContainerOverlayProps({
        placement: undefined,
        shouldFlip: undefined,
        isSubmenu: true,
      })
    ).toEqual({ placement: undefined, shouldFlip: true });
  });

  it("honors explicit caller overrides for both hosts", () => {
    expect(
      resolveMenuContainerOverlayProps({
        placement: "start top",
        shouldFlip: false,
        isSubmenu: true,
      })
    ).toEqual({ placement: "start top", shouldFlip: false });
  });
});

describe("MenuContainer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderMenu = (minWidth?: React.CSSProperties["minWidth"]) => {
    act(() => {
      root.render(
        <MenuTrigger defaultOpen>
          <Button>Open menu</Button>
          <MenuContainer aria-label="Test menu" minWidth={minWidth}>
            <Menu aria-label="Test menu items">
              <MenuItem id="a">Item A</MenuItem>
              <MenuItem id="b">Item B</MenuItem>
            </Menu>
          </MenuContainer>
        </MenuTrigger>
      );
    });
  };

  it("allows a caller to lower its content width floor", () => {
    renderMenu(0);

    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(getComputedStyle(menu.parentElement!).minWidth).toBe("0px");
  });

  it("does not lock document scrolling while open", () => {
    renderMenu();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    // Modal overlays prevent scrolling by styling the documentElement; a
    // transient pick-one menu must not.
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });

  it("consumes the outside press that dismisses the menu", async () => {
    const outsideButton = document.createElement("button");
    const onOutsideClick = vi.fn();
    outsideButton.textContent = "Row action beneath";
    outsideButton.addEventListener("click", onOutsideClick);
    document.body.appendChild(outsideButton);
    const user = userEvent.setup();

    renderMenu();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => user.click(outsideButton));

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(onOutsideClick).not.toHaveBeenCalled();

    await act(async () => user.click(outsideButton));
    expect(onOutsideClick).toHaveBeenCalledOnce();

    outsideButton.remove();
  });

  it("toggles closed from its own trigger without reopening", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open menu"
    )!;

    await act(async () => user.click(trigger));
    expect(document.querySelector('[role="menu"]')).toBeNull();

    await act(async () => user.click(trigger));
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
  });

  it("still activates menu items normally", async () => {
    const user = userEvent.setup();
    renderMenu();

    const itemA = Array.from(
      document.querySelectorAll('[role="menuitem"]')
    ).find((item) => item.textContent?.includes("Item A"))!;

    await act(async () => user.click(itemA));
    // Selecting an item closes the menu through React Aria's own path.
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
