import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResizableTraceTreePanelContent } from "../ResizableTraceTreePanelContent";

function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { clientX: number; pointerId?: number }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: init.clientX,
  });
  Object.defineProperty(event, "pointerId", {
    value: init.pointerId ?? 1,
  });
  element.dispatchEvent(event);
}

function toDOMRect({ left, width }: { left: number; width: number }): DOMRect {
  return {
    bottom: 100,
    height: 100,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("ResizableTraceTreePanelContent", () => {
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
    vi.restoreAllMocks();
  });

  it("starts an overlay resize from the rendered handle position", () => {
    const onResizeStart = vi.fn();
    const onResize = vi.fn((width: number) => width);
    const onResizeEnd = vi.fn();

    act(() => {
      root.render(
        createElement(
          ResizableTraceTreePanelContent,
          {
            onResize,
            onResizeEnd,
            onResizeStart,
          },
          createElement("div", null, "Trace tree")
        )
      );
    });

    const content = container.querySelector(".trace-tree-panel-content");
    const handle = container.querySelector(
      ".trace-tree-panel-content__resize-handle"
    );
    expect(content).toBeInstanceOf(HTMLDivElement);
    expect(handle).toBeInstanceOf(HTMLDivElement);
    if (!(content instanceof HTMLDivElement)) return;
    if (!(handle instanceof HTMLDivElement)) return;
    let capturedPointerId: number | null = null;
    Object.assign(handle, {
      hasPointerCapture: (pointerId: number) => capturedPointerId === pointerId,
      releasePointerCapture: () => {
        capturedPointerId = null;
      },
      setPointerCapture: (pointerId: number) => {
        capturedPointerId = pointerId;
      },
    });
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 100, width: 240 })
    );
    vi.spyOn(handle, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 339.5, width: 1 })
    );

    act(() => {
      dispatchPointerEvent(handle, "pointerdown", { clientX: 338 });
      dispatchPointerEvent(handle, "pointermove", { clientX: 358 });
      dispatchPointerEvent(handle, "pointerup", { clientX: 358 });
    });

    expect(onResizeStart).toHaveBeenCalledWith(240);
    expect(onResize).toHaveBeenCalledWith(260);
    expect(onResizeEnd).toHaveBeenCalledWith(true);
  });
});
