import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
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

  it("uses client-side routing for menu items with an href", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/source"]}>
          <Routes>
            <Route
              path="/source"
              element={
                <MenuTrigger defaultOpen>
                  <Button>Open menu</Button>
                  <MenuContainer aria-label="Test menu">
                    <Menu aria-label="Test menu items">
                      <MenuItem href="/destination">Destination</MenuItem>
                    </Menu>
                  </MenuContainer>
                </MenuTrigger>
              }
            />
            <Route path="/destination" element={<div>Destination page</div>} />
          </Routes>
        </MemoryRouter>
      );
    });

    const link =
      document.querySelector<HTMLAnchorElement>('a[role="menuitem"]')!;
    expect(link.getAttribute("href")).toBe("/destination");

    await act(async () => user.click(link));

    expect(container.textContent).toContain("Destination page");
  });
});
