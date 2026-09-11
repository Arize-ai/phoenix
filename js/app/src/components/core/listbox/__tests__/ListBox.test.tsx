import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { ListBox, ListBoxItem } from "..";

describe("ListBox", () => {
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

  it("shows the pointer cursor only for interactive items", () => {
    act(() => {
      root.render(
        <ListBox aria-label="Animals" selectionMode="single">
          <ListBoxItem id="cat">Cat</ListBoxItem>
          <ListBoxItem id="dog" isDisabled>
            Dog
          </ListBoxItem>
        </ListBox>
      );
    });

    const enabledItem = container.querySelector<HTMLElement>(
      '.react-aria-ListBoxItem[data-key="cat"]'
    );
    const disabledItem = container.querySelector<HTMLElement>(
      '.react-aria-ListBoxItem[data-key="dog"]'
    );

    expect(enabledItem).not.toBeNull();
    expect(disabledItem).not.toBeNull();
    expect(getComputedStyle(enabledItem!).cursor).toBe("pointer");
    expect(getComputedStyle(disabledItem!).cursor).toBe("default");
  });
});
