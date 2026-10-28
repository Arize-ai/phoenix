import { act } from "react";
import { createRoot } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import {
  DecisionStateInputsEditor,
  describeInputsState,
} from "../DecisionStateInputsEditor";

async function renderEditor(names: string[]) {
  const onChange = vi.fn<(names: string[]) => void>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <ThemeContext.Provider
        value={{
          theme: "dark",
          themeMode: "dark",
          systemTheme: "dark",
          setThemeMode: vi.fn(),
        }}
      >
        <DecisionStateInputsEditor
          names={names}
          isDisabled={false}
          isInvalid={false}
          onChange={onChange}
          onBlur={vi.fn()}
        />
      </ThemeContext.Provider>
    )
  );
  const slot = container.querySelector<HTMLInputElement>(
    'input[aria-label="Add input"]'
  )!;
  const type = async (text: string) =>
    act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setValue.call(slot, text);
      slot.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const press = async (key: string) =>
    act(async () => {
      slot.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  const cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, slot, onChange, type, press, cleanup };
}

it("describes what the inputs send", () => {
  expect(describeInputsState([])).toBeNull();
  expect(describeInputsState(["ticket"])).toBe(
    "Sends the value of ticket as-is"
  );
  expect(describeInputsState(["reference", "output"])).toBe(
    "Sends an object of 2 inputs"
  );
});

it("draws one input alone and several as an object", async () => {
  const one = await renderEditor(["ticket"]);
  try {
    expect(
      one.container.querySelector('[aria-label="State inputs"]')?.textContent
    ).toBe("ticket");
    expect(one.slot.placeholder).toBe("+ input");
  } finally {
    await one.cleanup();
  }
  const several = await renderEditor(["reference", "output"]);
  try {
    expect(
      several.container.querySelector('[aria-label="State inputs"]')
        ?.textContent
    ).toBe('{"reference": reference,"output": output}');
  } finally {
    await several.cleanup();
  }
  const none = await renderEditor([]);
  try {
    expect(none.slot.placeholder).toBe("+ add an input");
    expect(none.container.textContent).not.toContain("Sends");
  } finally {
    await none.cleanup();
  }
});

it("adds names on Enter or a comma, skipping duplicates", async () => {
  const editor = await renderEditor(["reference"]);
  try {
    await editor.type("output");
    await editor.press("Enter");
    expect(editor.onChange).toHaveBeenLastCalledWith(["reference", "output"]);
    expect(editor.slot.value).toBe("");

    await editor.type("reference, plan,");
    expect(editor.onChange).toHaveBeenLastCalledWith(["reference", "plan"]);
  } finally {
    await editor.cleanup();
  }
});

it("removes the last name on Backspace in an empty slot, and clears on Escape", async () => {
  const editor = await renderEditor(["reference", "output"]);
  try {
    await editor.type("dra");
    await editor.press("Backspace");
    expect(editor.onChange).not.toHaveBeenCalled();
    await editor.press("Escape");
    expect(editor.slot.value).toBe("");
    await editor.press("Backspace");
    expect(editor.onChange).toHaveBeenLastCalledWith(["reference"]);
  } finally {
    await editor.cleanup();
  }
});

it("removes one input from its pill", async () => {
  const editor = await renderEditor(["reference", "output"]);
  try {
    const remove = editor.container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove reference"]'
    );
    expect(remove).not.toBeNull();
    await act(async () => remove?.click());
    expect(editor.onChange).toHaveBeenLastCalledWith(["output"]);
  } finally {
    await editor.cleanup();
  }
});
