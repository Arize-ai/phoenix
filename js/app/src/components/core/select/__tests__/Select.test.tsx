import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { Button } from "../../button";
import { ListBox } from "../../listbox";
import { Popover } from "../../overlay";
import { Select } from "../Select";
import { SelectItem } from "../SelectItem";
import { SelectValue } from "../SelectValue";

describe("Select", () => {
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

  it("distinguishes pointer focus from keyboard-visible focus", async () => {
    act(() => {
      root.render(
        <>
          <Select aria-label="Input mode" defaultValue="path">
            <Button>
              <SelectValue />
            </Button>
            <Popover>
              <ListBox>
                <SelectItem id="path" textValue="Path">
                  Path
                </SelectItem>
                <SelectItem id="text" textValue="Text">
                  Text
                </SelectItem>
              </ListBox>
            </Popover>
          </Select>
          <input aria-label="Next field" />
        </>
      );
    });

    const select = container.querySelector<HTMLElement>(".select");
    const trigger = container.querySelector<HTMLButtonElement>("button");
    const nextField = container.querySelector<HTMLInputElement>(
      'input[aria-label="Next field"]'
    );
    expect(select).not.toBeNull();
    expect(trigger).not.toBeNull();
    expect(nextField).not.toBeNull();

    const user = userEvent.setup();
    await act(async () => user.click(nextField!));
    act(() => trigger?.focus());

    expect(document.activeElement).toBe(trigger);
    expect(select?.hasAttribute("data-focused")).toBe(true);
    expect(select?.hasAttribute("data-focus-visible")).toBe(false);

    act(() => nextField?.focus());
    await act(async () => user.tab({ shift: true }));

    expect(document.activeElement).toBe(trigger);
    expect(select?.hasAttribute("data-focused")).toBe(true);
    expect(select?.hasAttribute("data-focus-visible")).toBe(true);
  });
});
