import { act, createElement, useContext } from "react";
import { OverlayTriggerStateContext } from "react-aria-components";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "../Drawer";

function dispatchPointerEvent(element: Element, type: string, clientX: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  Object.defineProperty(event, "isPrimary", { value: true });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  element.dispatchEvent(event);
}

function CloseDrawerButton() {
  const overlayState = useContext(OverlayTriggerStateContext);
  return createElement(
    "button",
    { onClick: () => overlayState?.close() },
    "Close drawer"
  );
}

describe("Drawer", () => {
  let container: HTMLDivElement;
  let documentPointerEventListener: EventListener | null;
  let root: Root;
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    container = document.createElement("div");
    documentPointerEventListener = null;
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    if (documentPointerEventListener) {
      document.removeEventListener(
        "pointerdown",
        documentPointerEventListener,
        true
      );
      document.removeEventListener(
        "pointermove",
        documentPointerEventListener,
        true
      );
      document.removeEventListener(
        "pointerup",
        documentPointerEventListener,
        true
      );
    }
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
    const onResizeEnd = vi.fn();

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
            onResizeEnd,
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
    const drawerClassName = Array.from(drawer?.classList ?? []).find(
      (className) => className.startsWith("css-")
    );
    const resizeHandleStyleRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === `.${drawerClassName} .drawer__resize-handle`
      );
    expect(resizeHandleStyleRule?.style.zIndex).toBe(
      "calc(var(--global-z-index-local-control) + 2)"
    );
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
    expect(onResize).toHaveBeenLastCalledWith(55, 550);
    expect(onResizeEnd).toHaveBeenLastCalledWith(55, 550);

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
    expect(onResize).toHaveBeenLastCalledWith(50, 500);

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
    expect(onResize).toHaveBeenLastCalledWith(35, 350);

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
    expect(onResize).toHaveBeenLastCalledWith(95, 950);
    expect(onResizeEnd).toHaveBeenCalledTimes(4);
    expect(onResizeEnd).toHaveBeenLastCalledWith(95, 950);
  });

  it("keeps a pixel factory width independent of the viewport percentage", () => {
    const onResize = vi.fn();

    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            defaultSize: 1329,
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

    expect(drawer?.style.width).toBe("1329px");
    expect(drawer?.style.maxWidth).toBe("95vw");

    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowRight",
        })
      );
    });

    expect(drawer?.style.width).toBe("900px");
    expect(onResize).toHaveBeenLastCalledWith(90, 900);
  });

  it("commits its current user-resized width again before closing", () => {
    const closeSequence: string[] = [];
    const onClose = vi.fn(() => closeSequence.push("close"));
    const onResizeEnd = vi.fn(() => closeSequence.push("commit"));

    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            defaultSize: "50%",
            isOpen: true,
            maxSize: "95%",
            minSize: "35%",
            onClose,
            onResizeEnd,
          },
          createElement(CloseDrawerButton)
        )
      );
    });

    const handle = container.querySelector(
      '[role="separator"]'
    ) as HTMLDivElement | null;
    const closeButton = container.querySelector("button");

    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowLeft",
        })
      );
    });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onResizeEnd).toHaveBeenLastCalledWith(55, 550);

    closeSequence.length = 0;
    act(() => {
      closeButton?.click();
    });
    expect(onResizeEnd).toHaveBeenCalledTimes(2);
    expect(onResizeEnd).toHaveBeenLastCalledWith(55, 550);
    expect(onClose).toHaveBeenCalledOnce();
    expect(closeSequence).toEqual(["commit", "close"]);
  });

  it("does not emit an unmatched resize move when a pointer drag is clamped", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });

    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            defaultSize: 950,
            isOpen: true,
            maxSize: 950,
            minSize: 350,
            onResize,
            onResizeEnd,
          },
          createElement("div", null, "Drawer content")
        )
      );
    });

    const handle = container.querySelector('[role="separator"]');
    expect(handle).not.toBeNull();
    if (!(handle instanceof HTMLDivElement)) return;
    Object.assign(handle, {
      hasPointerCapture: () => true,
      releasePointerCapture: () => {},
      setPointerCapture: () => {},
    });

    act(() => {
      dispatchPointerEvent(handle, "pointerdown", 50);
      dispatchPointerEvent(handle, "pointermove", 0);
      animationFrameCallback?.(0);
      dispatchPointerEvent(handle, "pointerup", 0);
    });

    expect(onResize).not.toHaveBeenCalled();
    expect(onResizeEnd).not.toHaveBeenCalled();
  });

  it("ends a resize gesture that returns to its starting width", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });

    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            defaultSize: 500,
            isOpen: true,
            maxSize: 950,
            minSize: 350,
            onResize,
            onResizeEnd,
          },
          createElement("div", null, "Drawer content")
        )
      );
    });

    const handle = container.querySelector('[role="separator"]');
    expect(handle).not.toBeNull();
    if (!(handle instanceof HTMLDivElement)) return;
    Object.assign(handle, {
      hasPointerCapture: () => true,
      releasePointerCapture: () => {},
      setPointerCapture: () => {},
    });

    act(() => {
      dispatchPointerEvent(handle, "pointerdown", 500);
      dispatchPointerEvent(handle, "pointermove", 400);
      animationFrameCallbacks.shift()?.(0);
      dispatchPointerEvent(handle, "pointermove", 500);
      animationFrameCallbacks.shift()?.(0);
      dispatchPointerEvent(handle, "pointerup", 500);
    });

    expect(onResize).toHaveBeenNthCalledWith(1, 60, 600);
    expect(onResize).toHaveBeenNthCalledWith(2, 50, 500);
    expect(onResizeEnd).toHaveBeenCalledOnce();
    expect(onResizeEnd).toHaveBeenLastCalledWith(50, 500);
  });

  it("owns an outer drag when it crosses a descendant separator", () => {
    const onResizeEnd = vi.fn();
    const documentPointerEvents: string[] = [];
    const recordDocumentPointerEvent = (event: Event) => {
      documentPointerEvents.push(event.type);
    };
    documentPointerEventListener = recordDocumentPointerEvent;
    document.addEventListener("pointerdown", recordDocumentPointerEvent, true);
    document.addEventListener("pointermove", recordDocumentPointerEvent, true);
    document.addEventListener("pointerup", recordDocumentPointerEvent, true);

    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            defaultSize: 700,
            isOpen: true,
            maxSize: 950,
            minSize: 350,
            onResizeEnd,
          },
          createElement(
            "div",
            {
              "aria-label": "Resize inner panel",
              role: "separator",
              tabIndex: 0,
            },
            "Inner separator"
          )
        )
      );
    });

    const handles = container.querySelectorAll('[role="separator"]');
    const outerHandle = handles.item(0);
    const innerHandle = handles.item(1);
    expect(outerHandle).toBeInstanceOf(HTMLDivElement);
    expect(innerHandle).toBeInstanceOf(HTMLDivElement);
    if (
      !(outerHandle instanceof HTMLDivElement) ||
      !(innerHandle instanceof HTMLDivElement)
    ) {
      return;
    }

    let capturedPointerId: number | null = null;
    const releasePointerCapture = vi.fn(() => {
      capturedPointerId = null;
    });
    Object.assign(outerHandle, {
      hasPointerCapture: (pointerId: number) => capturedPointerId === pointerId,
      releasePointerCapture,
      setPointerCapture: (pointerId: number) => {
        capturedPointerId = pointerId;
      },
    });

    act(() => innerHandle.focus());
    expect(document.activeElement).toBe(innerHandle);

    act(() => {
      dispatchPointerEvent(outerHandle, "pointerdown", 300);
      // Pointer capture keeps the outer handle as the event target even after
      // the cursor crosses the inner separator's screen coordinate.
      dispatchPointerEvent(outerHandle, "pointermove", 600);
      dispatchPointerEvent(outerHandle, "pointerup", 600);
    });

    expect(document.activeElement).toBe(outerHandle);
    expect(documentPointerEvents).toEqual([]);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(outerHandle.dataset.dragging).toBeUndefined();
    expect(onResizeEnd).toHaveBeenCalledOnce();

    act(() => {
      dispatchPointerEvent(innerHandle, "pointermove", 600);
    });
    expect(documentPointerEvents).toEqual(["pointermove"]);
  });
});
