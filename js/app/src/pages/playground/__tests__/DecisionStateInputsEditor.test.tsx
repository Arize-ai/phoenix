import type { ComponentProps } from "react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { DecisionStateInputsEditor } from "../DecisionStateInputsEditor";

async function renderEditor(
  names: string[],
  props: Partial<ComponentProps<typeof DecisionStateInputsEditor>> = {}
) {
  const onChange = vi.fn<(names: string[]) => void>();
  const onWrap = vi.fn<() => void>();
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
          inputsShape="object"
          isDisabled={false}
          isInvalid={false}
          onChange={onChange}
          onWrap={onWrap}
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
  // The drawn state, without the (hidden) Enter key hint or the Wrap link.
  const stateText = () =>
    container
      .querySelector('[aria-label="State inputs"]')
      ?.textContent?.replace("↵", "")
      .replace("Wrap in an object", "");
  return { container, slot, onChange, onWrap, type, press, cleanup, stateText };
}

it("draws one input sent alone as the input, and an object keyed by name", async () => {
  const one = await renderEditor(["ticket"], { inputsShape: "value" });
  try {
    expect(one.stateText()).toBe("ticket");
    expect(one.slot.placeholder).toBe("+ input");
  } finally {
    await one.cleanup();
  }
  const wrapped = await renderEditor(["ticket"]);
  try {
    expect(wrapped.stateText()).toBe('{"ticket": ticket}');
  } finally {
    await wrapped.cleanup();
  }
  const several = await renderEditor(["reference", "output"]);
  try {
    expect(several.stateText()).toBe(
      '{"reference": reference,"output": output}'
    );
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
        inputsShape="value"
        isDisabled={false}
        isInvalid={false}
        onChange={(next) => {
          onChange(next);
          setNames(next);
        }}
        onWrap={vi.fn()}
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
    inputsShape: "value",
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

it("shows the Enter key beside the slot while a name is typed", async () => {
  const editor = await renderEditor(["ticket"]);
  // The hint is always laid out, so showing it does not shift the line.
  const hint = () =>
    editor.container.querySelector(".decision-state-inputs__enter-hint");
  try {
    expect(hint()?.textContent).toBe("↵");
    expect(hint()?.hasAttribute("data-visible")).toBe(false);
    await editor.type("customer");
    expect(hint()?.hasAttribute("data-visible")).toBe(true);
    await editor.press("Enter");
    expect(editor.onChange).toHaveBeenLastCalledWith(["ticket", "customer"]);
    expect(hint()?.hasAttribute("data-visible")).toBe(false);
  } finally {
    await editor.cleanup();
  }
});

it("has no footer", async () => {
  const editor = await renderEditor(["ticket"]);
  try {
    expect(
      editor.container.querySelector(".decision-state-inputs__footer")
    ).toBeNull();
    expect(editor.container.textContent).not.toContain("Sends");
  } finally {
    await editor.cleanup();
  }
});

it("adds a typed name along with the dataset's when Add all is pressed", async () => {
  const editor = await renderEditor([], {
    suggestions: ["phrase", "context"],
  });
  try {
    await editor.type("extra");
    const addAll = Array.from(
      editor.container.querySelectorAll<HTMLElement>(
        ".decision-state-inputs__add-all"
      )
    )[0];
    // The button never takes focus from the slot (checked in the browser),
    // so the typed name is added together with the dataset's, in one change.
    await act(async () => addAll.click());
    expect(editor.onChange).toHaveBeenCalledTimes(1);
    expect(editor.onChange).toHaveBeenLastCalledWith([
      "extra",
      "phrase",
      "context",
    ]);
  } finally {
    await editor.cleanup();
  }
});

it("offers to wrap an input sent alone in an object, and only then", async () => {
  const alone = await renderEditor(["state"], { inputsShape: "value" });
  try {
    const wrap = Array.from(alone.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Wrap in an object"
    );
    await act(async () => wrap?.click());
    expect(alone.onWrap).toHaveBeenCalledTimes(1);
  } finally {
    await alone.cleanup();
  }
  const wrapped = await renderEditor(["state"]);
  try {
    expect(wrapped.container.textContent).not.toContain("Wrap in an object");
  } finally {
    await wrapped.cleanup();
  }
});
