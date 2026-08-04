import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColumnSelectorMenu } from "../ColumnSelector";

const columns = [
  { id: "name", label: "Name" },
  { id: "latency", label: "Latency" },
  { id: "tokens", label: "Total Tokens" },
];

/**
 * Types into the search field the way React sees it: the native value setter
 * bypasses React's own value tracking, so the subsequent `input` event is not
 * swallowed as a no-op change.
 */
function typeIntoSearch(container: HTMLElement, value: string) {
  const input = container.querySelector("input") as HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )!.set!;
  act(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ColumnSelectorMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderMenu() {
    act(() => {
      root.render(
        <ColumnSelectorMenu
          columns={columns}
          columnVisibility={{}}
          onColumnVisibilityChange={() => {}}
        />
      );
    });
  }

  it("renders a row per column when there is no search query", () => {
    renderMenu();
    expect(container.querySelectorAll("li")).toHaveLength(columns.length);
  });

  it("shows an empty state instead of a blank list when the search matches nothing", async () => {
    renderMenu();
    typeIntoSearch(container, "zzzznotacolumn");
    // The search is debounced, so the filter has not been applied yet
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).toContain("No results");
  });

  it("filters to the matching columns", async () => {
    renderMenu();
    typeIntoSearch(container, "tokens");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    const rows = container.querySelectorAll("li");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Total Tokens");
  });
});
