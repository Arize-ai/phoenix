import { act, createElement, type ReactNode } from "react";
import { Dialog } from "react-aria-components";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "../Drawer";
import { OverlayFrameProvider, useOverlayFrame } from "../frame";
import { ViewportModal, ViewportModalOverlay } from "../ViewportModal";

function HostedDrawerFrame({ children }: { children: ReactNode }) {
  return createElement(
    OverlayFrameProvider,
    null,
    createElement(DrawerHost, null, children)
  );
}

function DrawerHost({ children }: { children: ReactNode }) {
  const frame = useOverlayFrame();
  return createElement(
    "div",
    null,
    createElement("div", {
      "data-side-navigation": "",
      ref: frame?.setSideNavigationElement,
    }),
    createElement("div", {
      "data-drawer-host": "",
      ref: frame?.setDrawerHostElement,
    }),
    createElement("div", {
      "data-viewport-modal-host": "",
      ref: frame?.setViewportModalHostElement,
    }),
    children
  );
}

describe("Drawer", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalInnerWidth = window.innerWidth;
  let drawerHostWidth = 800;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    drawerHostWidth = 800;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRect(this: HTMLElement) {
        if (this.hasAttribute("data-drawer-host")) {
          return {
            bottom: 600,
            height: 600,
            left: 0,
            right: drawerHostWidth,
            top: 0,
            width: drawerHostWidth,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this.hasAttribute("data-side-navigation")) {
          return {
            bottom: 600,
            height: 600,
            left: 0,
            right: 52,
            top: 0,
            width: 52,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
    );
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

    expect(drawer?.style.width).toBe("92vw");
    expect(handle?.getAttribute("aria-valuenow")).toBe("92");
    expect(onResize).toHaveBeenLastCalledWith(92);
  });

  it("does not dismiss underneath a viewport-modal Escape", () => {
    const onClose = vi.fn();

    act(() => {
      root.render(
        createElement(
          HostedDrawerFrame,
          null,
          createElement(
            Drawer,
            { isOpen: true, onClose },
            createElement("div", null, "Drawer content")
          ),
          createElement(ViewportModalOverlay, {
            children: createElement(
              ViewportModal,
              null,
              createElement(Dialog, { "aria-label": "Edit form" })
            ),
            defaultOpen: true,
          })
        )
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    act(() => {
      dialog?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("clamps the hard minimum when an isolated host is narrower", () => {
    drawerHostWidth = 240;

    act(() => {
      root.render(
        createElement(
          HostedDrawerFrame,
          null,
          createElement(
            Drawer,
            { defaultSize: "35%", isOpen: true },
            createElement("div", null, "Drawer content")
          )
        )
      );
    });

    const host = container.querySelector("[data-drawer-host]");
    const drawer = host?.querySelector<HTMLElement>('[role="complementary"]');
    const handle = host?.querySelector<HTMLElement>('[role="separator"]');

    expect(drawer?.style.width).toBe("100%");
    expect(drawer?.style.minWidth).toBe("240px");
    expect(drawer?.style.maxWidth).toBe("240px");
    expect(handle?.getAttribute("aria-valuemin")).toBe("100");
    expect(handle?.getAttribute("aria-valuemax")).toBe("100");
  });
});
