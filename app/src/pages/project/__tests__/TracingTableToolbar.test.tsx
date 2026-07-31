import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DRAWER_CLASS_NAME } from "@phoenix/components/core/overlay/constants";

import { TracingTableToolbar } from "../TracingTableToolbar";

describe("TracingTableToolbar", () => {
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
    document
      .querySelectorAll(`.${DRAWER_CLASS_NAME}`)
      .forEach((element) => element.remove());
  });

  function renderToolbar() {
    act(() => {
      root.render(
        <TracingTableToolbar
          collapseColumnWithField
          field={<div>Filter</div>}
          columnSelector={
            <button
              type="button"
              className="column-selector__button"
              aria-label="Columns"
            >
              <span className="column-selector__button-label">Columns</span>
            </button>
          }
          primaryAction={<button type="button">Expand</button>}
          actions={<button type="button">Charts</button>}
        />
      );
    });
  }

  it("keeps the field, column selector, and primary action when a drawer opens", async () => {
    renderToolbar();

    expect(container.textContent).toContain("Filter");
    expect(container.textContent).toContain("Charts");
    expect(container.textContent).toContain("Columns");
    expect(container.textContent).toContain("Expand");

    const drawer = document.createElement("div");
    drawer.className = DRAWER_CLASS_NAME;
    await act(async () => {
      document.body.appendChild(drawer);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Filter");
    expect(container.textContent).toContain("Columns");
    expect(container.textContent).not.toContain("Charts");
    expect(container.textContent).toContain("Expand");
    expect(
      container
        .querySelector(".tracing-table-toolbar")
        ?.getAttribute("data-has-open-drawer")
    ).toBe("true");

    await act(async () => {
      drawer.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Charts");
    expect(container.textContent).toContain("Expand");
  });
});
