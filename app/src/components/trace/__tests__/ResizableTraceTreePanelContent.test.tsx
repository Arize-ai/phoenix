import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Group, Panel } from "react-resizable-panels";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResizableTraceTreePanelContent,
  ResizableTraceTreeSeparator,
} from "../ResizableTraceTreePanelContent";

function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { clientX: number; pointerId?: number }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: init.clientX,
  });
  Object.defineProperty(event, "pointerId", {
    value: init.pointerId ?? 1,
  });
  Object.defineProperty(event, "isPrimary", { value: true });
  element.dispatchEvent(event);
}

function dispatchKeyboardEvent(element: Element, key: string) {
  element.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
    })
  );
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
  let originalResizeObserver: typeof ResizeObserver;
  let resizeObserverEntries: Array<{
    callback: ResizeObserverCallback;
    observer: ResizeObserver;
  }>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    originalResizeObserver = globalThis.ResizeObserver;
    resizeObserverEntries = [];
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverEntries.push({ callback, observer: this });
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it("keeps its only separator at the allocated edge while resizing", () => {
    const onResizeStart = vi.fn();
    const onResize = vi.fn((width: number) => width);
    const onResizeEnd = vi.fn();

    act(() => {
      root.render(
        createElement(
          Group,
          { orientation: "horizontal" },
          createElement(
            Panel,
            { defaultSize: 48, minSize: 48 },
            createElement(
              ResizableTraceTreePanelContent,
              null,
              createElement("div", null, "Trace tree")
            )
          ),
          createElement(ResizableTraceTreeSeparator, {
            onResize,
            onResizeEnd,
            onResizeStart,
          }),
          createElement(Panel, null, createElement("div", null, "Details"))
        )
      );
    });

    const panel = container.querySelector("[data-panel]");
    const content = container.querySelector(".trace-tree-panel-content");
    const separator = container.querySelector(".details-panel-tree-separator");
    expect(panel).toBeInstanceOf(HTMLDivElement);
    expect(content).toBeInstanceOf(HTMLDivElement);
    expect(separator).toBeInstanceOf(HTMLDivElement);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
    if (
      !(panel instanceof HTMLDivElement) ||
      !(content instanceof HTMLDivElement) ||
      !(separator instanceof HTMLDivElement)
    ) {
      return;
    }

    let capturedPointerId: number | null = null;
    Object.assign(separator, {
      hasPointerCapture: (pointerId: number) => capturedPointerId === pointerId,
      releasePointerCapture: () => {
        capturedPointerId = null;
      },
      setPointerCapture: (pointerId: number) => {
        capturedPointerId = pointerId;
      },
    });
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 100, width: 48 })
    );
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 100, width: 240 })
    );

    act(() => {
      resizeObserverEntries.forEach(({ callback, observer }) =>
        callback([], observer)
      );
    });

    expect(separator.style.transform).toBe("");

    act(() => {
      dispatchPointerEvent(separator, "pointerdown", { clientX: 340 });
    });

    expect(separator.dataset.separator).not.toBe("active");

    act(() => {
      dispatchPointerEvent(separator, "pointermove", { clientX: 360 });
      dispatchPointerEvent(separator, "pointerup", { clientX: 360 });
    });

    expect(onResizeStart).toHaveBeenCalledWith(48);
    expect(onResize).toHaveBeenCalledWith(68);
    expect(onResizeEnd).toHaveBeenCalledWith({
      didMove: true,
      shouldCommit: true,
    });
  });

  it("provides the preferred overlay width to collapsed navigation", () => {
    act(() => {
      root.render(
        createElement(
          ResizableTraceTreePanelContent,
          { expandedWidth: 368, isCollapsed: true },
          createElement(
            "div",
            { className: "trace-tree-navigation" },
            "Trace tree"
          )
        )
      );
    });

    const content = container.querySelector(".trace-tree-panel-content");
    const navigation = container.querySelector(".trace-tree-navigation");
    expect(content?.getAttribute("data-collapsed")).toBe("true");
    expect(navigation).toBeInstanceOf(HTMLDivElement);
    expect(document.head.textContent).toContain(
      "--trace-tree-overlay-width:368px"
    );
  });

  it("does not mark expanded panel content as collapsed", () => {
    act(() => {
      root.render(
        createElement(
          ResizableTraceTreePanelContent,
          { expandedWidth: 368 },
          "Trace tree"
        )
      );
    });

    const content = container.querySelector(".trace-tree-panel-content");
    expect(content?.getAttribute("data-collapsed")).toBe("false");
  });

  it("uses the active navigation-scrollbar driver for expanded and hovered navigation", () => {
    const renderContent = ({
      isCollapsed,
      isHoverOpen = false,
    }: {
      isCollapsed: boolean;
      isHoverOpen?: boolean;
    }) =>
      createElement(
        ResizableTraceTreePanelContent,
        { expandedWidth: 368, isCollapsed },
        createElement(
          "div",
          {
            "data-navigation-scrollbar": isHoverOpen ? "active" : undefined,
          },
          createElement(
            "ul",
            { "data-trace-tree-root": true },
            createElement("li", null, "Trace")
          )
        )
      );

    act(() => root.render(renderContent({ isCollapsed: false })));

    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-trace-tree-root]"
    );
    const panelContent = container.querySelector<HTMLElement>(
      ".trace-tree-panel-content"
    );
    expect(panelContent?.dataset.navigationScrollbar).toBe("active");
    expect(getComputedStyle(scrollContainer!).scrollbarGutter).toBe("stable");
    expect(getComputedStyle(scrollContainer!).scrollbarColor).toBe(
      "var(--global-color-gray-300) transparent"
    );

    act(() => root.render(renderContent({ isCollapsed: true })));

    expect(panelContent?.dataset.navigationScrollbar).toBeUndefined();
    expect(getComputedStyle(scrollContainer!).scrollbarGutter).toBe("auto");

    act(() =>
      root.render(renderContent({ isCollapsed: true, isHoverOpen: true }))
    );

    expect(panelContent?.dataset.navigationScrollbar).toBeUndefined();
    expect(getComputedStyle(scrollContainer!).scrollbarGutter).toBe("stable");
    expect(getComputedStyle(scrollContainer!).scrollbarColor).toBe(
      "var(--global-color-gray-300) transparent"
    );
  });

  it("owns the complete pointer lifecycle and reports cancellation", () => {
    const onResizeStart = vi.fn();
    const onResize = vi.fn((width: number) => width);
    const onResizeEnd = vi.fn();

    act(() => {
      root.render(
        createElement(
          Group,
          { orientation: "horizontal" },
          createElement(
            Panel,
            { defaultSize: 368, minSize: 48 },
            createElement(ResizableTraceTreePanelContent, null, "Trace tree")
          ),
          createElement(ResizableTraceTreeSeparator, {
            onResize,
            onResizeEnd,
            onResizeStart,
          }),
          createElement(Panel, null, "Details")
        )
      );
    });

    const panel = container.querySelector("[data-panel]");
    const separator = container.querySelector(".details-panel-tree-separator");
    if (
      !(panel instanceof HTMLDivElement) ||
      !(separator instanceof HTMLDivElement)
    ) {
      return;
    }

    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 100, width: 168 })
    );
    let capturedPointerId: number | null = null;
    Object.assign(separator, {
      hasPointerCapture: (pointerId: number) => capturedPointerId === pointerId,
      releasePointerCapture: () => {
        capturedPointerId = null;
      },
      setPointerCapture: (pointerId: number) => {
        capturedPointerId = pointerId;
      },
    });

    act(() => {
      dispatchPointerEvent(separator, "pointerdown", { clientX: 468 });
    });
    expect(onResizeStart).toHaveBeenCalledWith(168);

    act(() => {
      dispatchPointerEvent(separator, "pointermove", { clientX: 300 });
      dispatchPointerEvent(separator, "pointercancel", { clientX: 300 });
    });

    expect(onResize).toHaveBeenCalledWith(0);
    expect(onResizeEnd).toHaveBeenCalledWith({
      didMove: true,
      shouldCommit: false,
    });
  });

  it("reports leftward travel from a compact-width separator", () => {
    const onResizeStart = vi.fn();
    const onResize = vi.fn((width: number) => width);
    const onResizeEnd = vi.fn();

    act(() => {
      root.render(
        createElement(
          Group,
          { orientation: "horizontal" },
          createElement(Panel, { defaultSize: 48 }, "Trace tree"),
          createElement(ResizableTraceTreeSeparator, {
            onResize,
            onResizeEnd,
            onResizeStart,
          }),
          createElement(Panel, null, "Details")
        )
      );
    });

    const separator = container.querySelector(".details-panel-tree-separator");
    if (!(separator instanceof HTMLDivElement)) return;

    const panel = container.querySelector("[data-panel]");
    if (!(panel instanceof HTMLDivElement)) return;

    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 100, width: 48 })
    );
    let capturedPointerId: number | null = null;
    Object.assign(separator, {
      hasPointerCapture: (pointerId: number) => capturedPointerId === pointerId,
      releasePointerCapture: () => {
        capturedPointerId = null;
      },
      setPointerCapture: (pointerId: number) => {
        capturedPointerId = pointerId;
      },
    });

    act(() => {
      dispatchPointerEvent(separator, "pointerdown", { clientX: 148 });
      dispatchPointerEvent(separator, "pointermove", { clientX: 108 });
      dispatchPointerEvent(separator, "pointerup", { clientX: 108 });
    });

    expect(onResizeStart).toHaveBeenCalledWith(48);
    expect(onResize).toHaveBeenCalledWith(8);
    expect(onResizeEnd).toHaveBeenCalledWith({
      didMove: true,
      shouldCommit: true,
    });
  });

  it("maps compact separator arrow keys to the same resize lifecycle", () => {
    const onResizeStart = vi.fn();
    const onResize = vi.fn((width: number) => width);
    const onResizeEnd = vi.fn();

    act(() => {
      root.render(
        createElement(
          Group,
          { orientation: "horizontal" },
          createElement(Panel, { defaultSize: 48 }, "Trace tree"),
          createElement(ResizableTraceTreeSeparator, {
            isCompact: true,
            onResize,
            onResizeEnd,
            onResizeStart,
          }),
          createElement(Panel, null, "Details")
        )
      );
    });

    const panel = container.querySelector("[data-panel]");
    const separator = container.querySelector(".details-panel-tree-separator");
    if (
      !(panel instanceof HTMLDivElement) ||
      !(separator instanceof HTMLDivElement)
    ) {
      return;
    }
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      toDOMRect({ left: 100, width: 48 })
    );
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1600);

    act(() => dispatchKeyboardEvent(separator, "ArrowLeft"));

    expect(onResizeStart).toHaveBeenCalledWith(48);
    expect(onResize).toHaveBeenCalledWith(-32);
    expect(onResizeEnd).toHaveBeenCalledWith({
      didMove: true,
      shouldCommit: true,
    });
  });

  it("requests a navigation toggle when the separator is double-clicked", () => {
    const onResizeStart = vi.fn();
    const onResize = vi.fn((width: number) => width);
    const onResizeEnd = vi.fn();
    const onToggle = vi.fn();

    act(() => {
      root.render(
        createElement(
          Group,
          { orientation: "horizontal" },
          createElement(Panel, { defaultSize: 48 }, "Trace tree"),
          createElement(ResizableTraceTreeSeparator, {
            onResize,
            onResizeEnd,
            onResizeStart,
            onToggle,
          }),
          createElement(Panel, null, "Details")
        )
      );
    });

    const separator = container.querySelector(".details-panel-tree-separator");
    if (!(separator instanceof HTMLDivElement)) return;

    act(() => {
      separator.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    });

    expect(onToggle).toHaveBeenCalledOnce();
  });
});
