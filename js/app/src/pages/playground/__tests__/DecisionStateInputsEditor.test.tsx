import type { ComponentProps } from "react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import {
  DecisionStateInputsEditor,
  describeInputsState,
} from "../DecisionStateInputsEditor";

async function renderEditor(
  names: string[],
  props: Partial<ComponentProps<typeof DecisionStateInputsEditor>> = {}
) {
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
          {...props}
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

it("keeps focus in the slot when adding an input redraws the state as an object", async () => {
  const onChange = vi.fn<(names: string[]) => void>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  function Harness() {
    const [names, setNames] = useState(["reference"]);
    return (
      <DecisionStateInputsEditor
        names={names}
        isDisabled={false}
        isInvalid={false}
        onChange={(next) => {
          onChange(next);
          setNames(next);
        }}
        onBlur={vi.fn()}
      />
    );
  }
  const slot = () =>
    container.querySelector<HTMLInputElement>('input[aria-label="Add input"]')!;
  try {
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
          <Harness />
        </ThemeContext.Provider>
      )
    );
    await act(async () => slot().focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!.call(slot(), "output,");
      slot().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(["reference", "output"]);
    expect(document.activeElement).toBe(slot());
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("prints each input's value beside its pill as a comment", async () => {
  const editor = await renderEditor(["reference", "output", "plan"], {
    previews: {
      reference: {
        kind: "value",
        text: '{"capital":"Paris"}',
        full: '{\n  "capital": "Paris"\n}',
      },
      output: {
        kind: "value",
        source: "example 1",
        text: '"Paris"',
        full: "Paris",
      },
      plan: { kind: "missing", source: "example 1" },
    },
  });
  try {
    const comments = [
      ...editor.container.querySelectorAll<HTMLElement>(
        ".decision-state-inputs__comment"
      ),
    ];
    expect(comments.map((comment) => comment.textContent)).toEqual([
      '// {"capital":"Paris"}',
      '// example 1: "Paris"',
      "// not in example 1",
    ]);
    expect(comments[0].title).toBe('{\n  "capital": "Paris"\n}');
  } finally {
    await editor.cleanup();
  }
});

it("prints the single input's value on the same line as its pill", async () => {
  const editor = await renderEditor(["ticket"], {
    previews: { ticket: { kind: "value", text: '"Refund"', full: "Refund" } },
  });
  try {
    const lines = editor.container.querySelectorAll(
      ".decision-state-inputs__line"
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain('// "Refund"');
  } finally {
    await editor.cleanup();
  }
});

it("adds a suggested name picked from the slot's list", async () => {
  const editor = await renderEditor(["reference"], {
    suggestions: ["reference", "ticket", "customer"],
  });
  try {
    await act(async () => editor.slot.focus());
    await editor.type("tic");
    const options = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ];
    // Added names and names that do not match what is typed are not offered.
    expect(options.map((option) => option.textContent)).toEqual(["ticket"]);
    await act(async () => options[0].click());
    expect(editor.onChange).toHaveBeenLastCalledWith(["reference", "ticket"]);
  } finally {
    await editor.cleanup();
  }
});

it("still adds a typed name that is not suggested", async () => {
  const editor = await renderEditor([], { suggestions: ["ticket"] });
  try {
    await editor.type("notes");
    await editor.press("Enter");
    expect(editor.onChange).toHaveBeenLastCalledWith(["notes"]);
  } finally {
    await editor.cleanup();
  }
});

it("adds every suggested name at once from an empty state", async () => {
  const editor = await renderEditor([], {
    suggestions: ["ticket", "customer"],
  });
  try {
    const addAll = [
      ...editor.container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.startsWith("Add all"));
    expect(addAll?.textContent).toBe("Add all 2 inputs from the dataset");
    await act(async () => addAll?.click());
    expect(editor.onChange).toHaveBeenLastCalledWith(["ticket", "customer"]);
  } finally {
    await editor.cleanup();
  }
});

it("offers no add-all once an input is added", async () => {
  const editor = await renderEditor(["ticket"], {
    suggestions: ["ticket", "customer"],
  });
  try {
    expect(editor.container.textContent).not.toContain("Add all");
  } finally {
    await editor.cleanup();
  }
});
