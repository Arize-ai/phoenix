import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DRAWER_CLASS_NAME } from "@phoenix/components/core/overlay/constants";

import { useHasOpenDrawer } from "../useHasOpenModal";

function DrawerState() {
  const hasOpenDrawer = useHasOpenDrawer();
  return <span data-testid="drawer-open">{String(hasOpenDrawer)}</span>;
}

describe("useHasOpenModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document
      .querySelectorAll(`.${DRAWER_CLASS_NAME}`)
      .forEach((element) => element.remove());
  });

  it("tracks open drawers", async () => {
    act(() => {
      root.render(<DrawerState />);
    });

    expect(
      container.querySelector('[data-testid="drawer-open"]')?.textContent
    ).toBe("false");

    const drawer = document.createElement("div");
    drawer.className = DRAWER_CLASS_NAME;
    await act(async () => {
      document.body.appendChild(drawer);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      container.querySelector('[data-testid="drawer-open"]')?.textContent
    ).toBe("true");
  });
});
