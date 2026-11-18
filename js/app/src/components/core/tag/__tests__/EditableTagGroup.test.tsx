import { act, useState } from "react";
import { Form } from "react-aria-components";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { EditableTagGroup } from "../EditableTagGroup";
import type { TagGroupItem } from "../TagGroup";
import { TagPicker } from "../TagPicker";

installTestMatchMedia();

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

const OPTIONS: TagGroupItem[] = [
  { id: "production", label: "production", userColor: "#33c5e8" },
  { id: "banking", label: "banking", userColor: "#ff9b2e" },
  { id: "needs-review", label: "needs-review" },
];

/**
 * The group as a domain wrapper uses it: the set lives in the caller, the
 * picker writes the whole new set back, and a created option joins it.
 */
function LabelsHarness({
  initialIds,
  onChange,
  onCreate,
}: {
  initialIds: string[];
  onChange: (ids: string[]) => void;
  onCreate?: () => void;
}) {
  const [options, setOptions] = useState(OPTIONS);
  const [ids, setIds] = useState(initialIds);
  const update = (nextIds: string[]) => {
    setIds(nextIds);
    onChange(nextIds);
  };
  const items = ids.map((id) => options.find((option) => option.id === id)!);
  return (
    <EditableTagGroup
      aria-label="Dataset labels"
      items={items}
      onRemove={(removed) => update(ids.filter((id) => !removed.has(id)))}
      picker={
        <TagPicker
          options={options}
          selectedKeys={ids}
          onSelectionChange={(selected) => update([...selected])}
          renderCreateForm={({ onDone }) => (
            <button
              onClick={() => {
                onCreate?.();
                setOptions((current) => [
                  ...current,
                  { id: "new", label: "new-label" },
                ]);
                update([...ids, "new"]);
                onDone();
              }}
            >
              Save new label
            </button>
          )}
        />
      }
    />
  );
}

function render(element: React.ReactNode) {
  act(() => {
    root.render(
      <MemoryRouter>
        <ThemeProvider themeMode="light">{element}</ThemeProvider>
      </MemoryRouter>
    );
  });
}

function tagNames() {
  return Array.from(
    container.querySelectorAll('[aria-label="Dataset labels"] .tag__text')
  ).map((element) => element.textContent);
}

function getByRole(role: string, name: string) {
  const element = Array.from(
    document.querySelectorAll<HTMLElement>(`[role="${role}"], ${role}`)
  ).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === name ||
      candidate.textContent?.trim() === name
  );
  if (!element) {
    throw new Error(`no ${role} named ${name}`);
  }
  return element;
}

describe("EditableTagGroup", () => {
  it("shows the empty state and a named add control when nothing is attached", () => {
    render(<LabelsHarness initialIds={[]} onChange={vi.fn()} />);
    expect(container.textContent).toContain("No labels");
    expect(getByRole("button", "Add label")).toBeTruthy();
    expect(getByRole("group", "Dataset labels")).toBeTruthy();
  });

  it("is read-only without onRemove and a picker", () => {
    render(
      <EditableTagGroup
        aria-label="Dataset labels"
        items={OPTIONS.slice(0, 2)}
      />
    );
    expect(tagNames()).toEqual(["production", "banking"]);
    expect(container.querySelector("button")).toBeNull();
  });

  it("removes a tag with its remove button", async () => {
    const onChange = vi.fn();
    render(
      <LabelsHarness
        initialIds={["production", "banking"]}
        onChange={onChange}
      />
    );
    await act(async () =>
      userEvent.click(getByRole("button", "Remove production"))
    );
    expect(onChange).toHaveBeenLastCalledWith(["banking"]);
    expect(tagNames()).toEqual(["banking"]);
  });

  it("moves focus to the add control when the keyboard removes the last tag", async () => {
    const onChange = vi.fn();
    render(<LabelsHarness initialIds={["banking"]} onChange={onChange} />);
    const row = container.querySelector<HTMLElement>('[role="row"]');
    act(() => row!.focus());
    await act(async () => userEvent.keyboard("{Backspace}"));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(container.textContent).toContain("No labels");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Add label"
    );
  });

  it("adds an existing option from the picker", async () => {
    const onChange = vi.fn();
    render(<LabelsHarness initialIds={["production"]} onChange={onChange} />);
    await act(async () => userEvent.click(getByRole("button", "Add label")));
    const option = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')
    ).find((item) => item.textContent?.includes("needs-review"));
    expect(
      Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).map(
        (item) => item.getAttribute("aria-checked")
      )
    ).toEqual(["true", "false", "false"]);
    await act(async () => userEvent.click(option!));
    expect(onChange).toHaveBeenLastCalledWith(["production", "needs-review"]);
    expect(tagNames()).toEqual(["production", "needs-review"]);
  });

  it("creates a new option inline and attaches it", async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn();
    render(
      <LabelsHarness
        initialIds={["production"]}
        onChange={onChange}
        onCreate={onCreate}
      />
    );
    await act(async () => userEvent.click(getByRole("button", "Add label")));
    await act(async () =>
      userEvent.click(getByRole("button", "Create new label"))
    );
    await act(async () =>
      userEvent.click(getByRole("button", "Save new label"))
    );
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["production", "new"]);
    expect(tagNames()).toEqual(["production", "new-label"]);
    // back on the list, where the new option is checked
    expect(document.querySelectorAll('[role="menuitemcheckbox"]')).toHaveLength(
      4
    );
  });

  it("does not submit a surrounding form when a form inside the picker submits", async () => {
    const onOuterSubmit = vi.fn((event: React.FormEvent) =>
      event.preventDefault()
    );
    const onInnerSubmit = vi.fn((event: React.FormEvent) =>
      event.preventDefault()
    );
    render(
      <Form onSubmit={onOuterSubmit}>
        <EditableTagGroup
          aria-label="Dataset labels"
          items={[]}
          onRemove={vi.fn()}
          picker={
            <Form onSubmit={onInnerSubmit}>
              <button type="submit">Create Label</button>
            </Form>
          }
        />
      </Form>
    );
    await act(async () => userEvent.click(getByRole("button", "Add label")));
    await act(async () => userEvent.click(getByRole("button", "Create Label")));
    expect(onInnerSubmit).toHaveBeenCalledTimes(1);
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });
});
