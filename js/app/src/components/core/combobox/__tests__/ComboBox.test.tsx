import { act, createRef } from "react";
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

  it("offers line breaks after identifier separators without changing the option's name", async () => {
    const promptName = "support_ticket.classifier/v12:final";
    act(() => {
      root.render(
        <ComboBox label="Prompt">
          <ComboBoxItem id="long" textValue={promptName}>
            {promptName}
          </ComboBoxItem>
        </ComboBox>
      );
    });

    const user = userEvent.setup();
    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button).not.toBeNull();
    await act(async () => button && user.click(button));

    const option = document.querySelector<HTMLElement>('[role="option"]');
    expect(option).not.toBeNull();
    expect(option?.textContent).toBe(promptName);
    const textBeforeEachBreak = [
      ...(option?.querySelectorAll("wbr") ?? []),
    ].map((wordBreak) => wordBreak.previousSibling?.textContent);
    expect(textBeforeEachBreak).toEqual([
      "support_",
      "ticket.",
      "classifier/",
      "v12:",
    ]);
  });

  it("forwards native input props and refs", () => {
    const inputRef = createRef<HTMLInputElement>();
    const onCompositionStart = vi.fn();
    act(() => {
      root.render(
        <ComboBox
          label="Prompt"
          inputProps={{ ref: inputRef, onCompositionStart }}
        >
          <ComboBoxItem id="support" textValue="Customer support">
            Customer support
          </ComboBoxItem>
        </ComboBox>
      );
    });

    const promptInput = container.querySelector<HTMLInputElement>(
      'input[role="combobox"]'
    );
    expect(inputRef.current).toBe(promptInput);

    act(() => {
      promptInput?.dispatchEvent(
        new Event("compositionstart", { bubbles: true })
      );
    });
    expect(onCompositionStart).toHaveBeenCalledTimes(1);
  });
});
