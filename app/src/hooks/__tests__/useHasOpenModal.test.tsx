import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAWER_CLASS_NAME } from "@phoenix/components/core/overlay/constants";

import { useActiveDrawerWidth, useHasOpenDrawer } from "../useHasOpenModal";

let resizeCallback: ResizeObserverCallback | null = null;

function DrawerState() {
  const hasOpenDrawer = useHasOpenDrawer();
  const drawerWidth = useActiveDrawerWidth();
  return (
    <>
      <span data-testid="drawer-open">{String(hasOpenDrawer)}</span>
      <span data-testid="drawer-width">{drawerWidth}</span>
    </>
  );
}

describe("useHasOpenModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    resizeCallback = null;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe() {}

        unobserve() {}

        disconnect() {}
      }
    );
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
    vi.unstubAllGlobals();
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

  it("tracks the active drawer width as it is resized", async () => {
    act(() => {
      root.render(<DrawerState />);
    });

    expect(
      container.querySelector('[data-testid="drawer-width"]')?.textContent
    ).toBe("0");

    let drawerWidth = 420;
    const drawer = document.createElement("div");
    drawer.className = DRAWER_CLASS_NAME;
    Object.defineProperty(drawer, "offsetWidth", {
      configurable: true,
      get: () => drawerWidth,
    });
    await act(async () => {
      document.body.appendChild(drawer);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      container.querySelector('[data-testid="drawer-width"]')?.textContent
    ).toBe("420");

    drawerWidth = 320;
    act(() =>
      resizeCallback?.([], {
        observe() {},
        unobserve() {},
        disconnect() {},
      })
    );
    expect(
      container.querySelector('[data-testid="drawer-width"]')?.textContent
    ).toBe("320");

    await act(async () => {
      drawer.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      container.querySelector('[data-testid="drawer-width"]')?.textContent
    ).toBe("0");
  });
});
