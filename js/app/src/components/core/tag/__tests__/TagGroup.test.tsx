import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import type { TagGroupItem } from "../TagGroup";
import { TagGroup } from "../TagGroup";

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

const ITEMS: TagGroupItem[] = [
  { id: "production", label: "production", userColor: "#33c5e8" },
  { id: "banking", label: "banking", color: "orange" },
  { id: "needs-review", label: "needs-review" },
];

function render(element: ReactNode) {
  act(() => {
    root.render(
      <MemoryRouter>
        <ThemeProvider themeMode="light">{element}</ThemeProvider>
      </MemoryRouter>
    );
  });
}

function tagNames() {
  return Array.from(container.querySelectorAll(".tag__text")).map(
    (element) => element.textContent
  );
}

describe("TagGroup", () => {
  it("renders nothing for an empty set", () => {
    render(<TagGroup aria-label="Labels" items={[]} />);
    expect(container.querySelector(".tag-group")).toBeNull();
  });

  it("is a plain list with nothing focusable when read-only", () => {
    render(<TagGroup aria-label="Labels" items={ITEMS} />);
    const list = container.querySelector('[role="list"]');
    expect(list?.getAttribute("aria-label")).toBe("Labels");
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(container.querySelector("button, a, [tabindex]")).toBeNull();
  });

  it("removes the focused tag with Delete and Backspace", async () => {
    const onRemove = vi.fn();
    render(<TagGroup aria-label="Labels" items={ITEMS} onRemove={onRemove} />);
    const rows = container.querySelectorAll<HTMLElement>('[role="row"]');
    expect(rows).toHaveLength(3);
    act(() => rows[1].focus());
    await act(async () => userEvent.keyboard("{Delete}"));
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["banking"]));
    act(() => rows[0].focus());
    await act(async () => userEvent.keyboard("{Backspace}"));
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["production"]));
  });

  it("names each remove button after its tag", async () => {
    const onRemove = vi.fn();
    render(<TagGroup aria-label="Labels" items={ITEMS} onRemove={onRemove} />);
    const remove = container.querySelector<HTMLElement>(
      'button[aria-label="Remove needs-review"]'
    );
    expect(remove).not.toBeNull();
    await act(async () => userEvent.click(remove!));
    expect(onRemove).toHaveBeenCalledWith(new Set(["needs-review"]));
  });

  it("calls onAction with the pressed tag's id", async () => {
    const onAction = vi.fn();
    render(<TagGroup aria-label="Labels" items={ITEMS} onAction={onAction} />);
    const rows = container.querySelectorAll<HTMLElement>('[role="row"]');
    await act(async () => userEvent.click(rows[2]));
    expect(onAction).toHaveBeenCalledWith("needs-review");
  });

  it("collapses past the limit into a +N control that opens the rest", async () => {
    render(
      <TagGroup
        aria-label="Labels"
        items={ITEMS}
        overflow="collapse"
        limit={1}
      />
    );
    expect(tagNames()).toEqual(["production"]);
    const more = container.querySelector<HTMLElement>(
      'button[aria-label="Show 2 more"]'
    );
    expect(more?.textContent).toBe("+2");
    await act(async () => userEvent.click(more!));
    const popoverNames = Array.from(
      document.querySelectorAll('[role="dialog"] .tag__text')
    ).map((element) => element.textContent);
    expect(popoverNames).toEqual(["banking", "needs-review"]);
  });

  it("selects tags in a selectable set", async () => {
    const onSelectionChange = vi.fn();
    render(
      <TagGroup
        aria-label="Labels"
        items={ITEMS}
        selectionMode="multiple"
        defaultSelectedKeys={["banking"]}
        onSelectionChange={onSelectionChange}
      />
    );
    const rows = container.querySelectorAll<HTMLElement>('[role="row"]');
    expect(rows[1].getAttribute("aria-selected")).toBe("true");
    await act(async () => userEvent.click(rows[0]));
    expect(onSelectionChange).toHaveBeenCalledWith(
      new Set(["banking", "production"])
    );
  });
});
