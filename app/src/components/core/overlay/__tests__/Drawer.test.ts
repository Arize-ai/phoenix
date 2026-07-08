import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "../Drawer";

describe("Drawer", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
    vi.restoreAllMocks();
  });

  it("supports keyboard resizing from the separator", () => {
    const onResize = vi.fn();

    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            defaultSize: "50%",
            isOpen: true,
            maxSize: "95%",
            minSize: "35%",
            onResize,
          },
          createElement("div", null, "Drawer content")
        )
      );
    });

    const drawer = container.querySelector(
      '[role="complementary"]'
    ) as HTMLDivElement | null;
    const handle = container.querySelector(
      '[role="separator"]'
    ) as HTMLDivElement | null;

    expect(drawer).not.toBeNull();
    expect(handle).not.toBeNull();
    expect(handle?.tabIndex).toBe(0);
    expect(handle?.getAttribute("aria-controls")).toBe(drawer?.id);

    act(() => {
      handle?.focus();
    });

    expect(document.activeElement).toBe(handle);

    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowLeft",
        })
      );
    });

    expect(drawer?.style.width).toBe("55vw");
    expect(handle?.getAttribute("aria-valuenow")).toBe("55");
    expect(onResize).toHaveBeenLastCalledWith(55);

    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowRight",
        })
      );
    });

    expect(drawer?.style.width).toBe("50vw");
    expect(handle?.getAttribute("aria-valuenow")).toBe("50");
    expect(onResize).toHaveBeenLastCalledWith(50);

    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Home",
        })
      );
    });

    expect(drawer?.style.width).toBe("35vw");
    expect(handle?.getAttribute("aria-valuenow")).toBe("35");
    expect(onResize).toHaveBeenLastCalledWith(35);

    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "End",
        })
      );
    });

    expect(drawer?.style.width).toBe("95vw");
    expect(handle?.getAttribute("aria-valuenow")).toBe("95");
    expect(onResize).toHaveBeenLastCalledWith(95);
  });
});
