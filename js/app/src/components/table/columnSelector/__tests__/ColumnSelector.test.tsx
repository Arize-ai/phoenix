import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import type { ColumnSelectorColumn } from "../ColumnSelector";
import { ColumnSelectorMenu } from "../ColumnSelector";

const columns: ColumnSelectorColumn[] = [
  { id: "name", label: "Name" },
  { id: "latency", label: "Latency" },
  { id: "tokens", label: "Total Tokens" },
];

/** Matches `DebouncedSearch`'s default `debounceMs`. */
const DEBOUNCE_MS = 200;

describe("ColumnSelectorMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderMenu(menuColumns = columns) {
    act(() => {
      root.render(
        <ColumnSelectorMenu
          columns={menuColumns}
          columnVisibility={{}}
          onColumnVisibilityChange={() => {}}
        />
      );
    });
  }

  /**
   * Sets the search value directly and advances past the debounce. Prefer this
   * over `user.type` under fake timers — typing waits on real delays that the
   * fake clock never advances, which hangs the suite.
   */
  async function search(query: string) {
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setValue?.call(input!, query);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
  }

  it("renders a row per column when there is no search query", () => {
    renderMenu();
    expect(container.querySelectorAll("li")).toHaveLength(columns.length);
  });

  it("filters to the matching columns", async () => {
    renderMenu();
    await search("tokens");

    const rows = container.querySelectorAll("li");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Total Tokens");
  });

  it("shows an empty state instead of a blank list when the search matches nothing", async () => {
    renderMenu();
    await search("zzzznotacolumn");

    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).toContain("No results");
  });

  it("distinguishes having no columns at all from a search that matched none", () => {
    renderMenu([]);

    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).toContain("No columns");
    expect(container.textContent).not.toContain("No results");
  });

  it("announces the result count only once a search is active", async () => {
    renderMenu();
    const status = container.querySelector("[role='status']");
    expect(status).not.toBeNull();
    // Silent until the user searches, so opening the menu announces nothing
    expect(status!.textContent).toBe("");

    await search("tokens");
    expect(status!.textContent).toBe("1 column found");
  });
});
