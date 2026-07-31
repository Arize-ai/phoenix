import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColumnSelector } from "../ColumnSelector";

describe("ColumnSelector", () => {
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

  it("keeps an accessible name when consumers hide the visual label", () => {
    act(() => {
      root.render(
        <ColumnSelector
          columns={[]}
          columnVisibility={{}}
          onColumnVisibilityChange={() => undefined}
        />
      );
    });

    const button = container.querySelector<HTMLButtonElement>(
      ".column-selector__button"
    );
    expect(button?.getAttribute("aria-label")).toBe("Columns");
    expect(
      button?.querySelector(".column-selector__button-label")?.textContent
    ).toBe("Columns");
  });
});
