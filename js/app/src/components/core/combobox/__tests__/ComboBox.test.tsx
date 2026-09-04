import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { ComboBox, ComboBoxItem } from "../ComboBox";

describe("ComboBox", () => {
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

  it("preserves native Tab navigation while stopping keyboard propagation", async () => {
    const onParentKeyDown = vi.fn();
    const onParentKeyUp = vi.fn();
    act(() => {
      root.render(
        <div onKeyDown={onParentKeyDown} onKeyUp={onParentKeyUp}>
          <ComboBox label="Prompt" stopPropagation>
            <ComboBoxItem id="support" textValue="Customer support">
              Customer support
            </ComboBoxItem>
          </ComboBox>
          <label>
            Description
            <input aria-label="Description" />
          </label>
        </div>
      );
    });

    const promptInput = container.querySelector<HTMLInputElement>(
      'input[role="combobox"]'
    );
    const descriptionInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Description"]'
    );
    expect(promptInput).not.toBeNull();
    expect(descriptionInput).not.toBeNull();

    act(() => promptInput?.focus());
    onParentKeyDown.mockClear();
    const user = userEvent.setup();

    await act(async () => user.tab());

    expect(document.activeElement).toBe(descriptionInput);
    expect(onParentKeyDown).not.toHaveBeenCalled();

    await act(async () => user.tab({ shift: true }));

    expect(document.activeElement).toBe(promptInput);
    onParentKeyDown.mockClear();
    onParentKeyUp.mockClear();

    await act(async () => user.keyboard("{ArrowDown}"));

    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(onParentKeyUp).not.toHaveBeenCalled();
  });
});
