import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { Button } from "../../button";
import { Menu, MenuContainer, MenuItem, MenuTrigger } from "../Menu";

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

  const renderMenu = (): void => {
    act(() => {
      root.render(
        <MenuTrigger defaultOpen>
          <Button>Open menu</Button>
          <MenuContainer aria-label="Test menu">
            <Menu aria-label="Test menu items">
              <MenuItem id="a">Item A</MenuItem>
              <MenuItem id="b">Item B</MenuItem>
            </Menu>
          </MenuContainer>
        </MenuTrigger>
      );
    });
  };

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
});
