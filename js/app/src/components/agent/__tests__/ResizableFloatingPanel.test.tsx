import { act, useState, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentFabPlacement } from "@phoenix/store/agentStore";
import type { Bounds, Size } from "@phoenix/types/geometry";

import { ResizableFloatingPanel } from "../ResizableFloatingPanel";

const DEFAULT_SIZE: Size = {
  width: 520,
  height: 720,
};

const MIN_SIZE: Size = {
  width: 480,
  height: 520,
};

function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { clientX: number; clientY: number; pointerId?: number }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, "pointerId", {
    value: init.pointerId ?? 1,
  });
  element.dispatchEvent(event);
}

function toDOMRect(bounds: Bounds): DOMRect {
  return {
    bottom: bounds.top + bounds.height,
    height: bounds.height,
    left: bounds.left,
    right: bounds.left + bounds.width,
    top: bounds.top,
    width: bounds.width,
    x: bounds.left,
    y: bounds.top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createBoundaryRef(bounds: Bounds): RefObject<HTMLElement | null> {
  const boundary = document.createElement("div");
  vi.spyOn(boundary, "getBoundingClientRect").mockReturnValue(
    toDOMRect(bounds)
  );
  return { current: boundary };
}

/**
 * A boundary whose reported rect can change after mount, simulating a layout
 * reflow (e.g. the content area widening as the docked panel is removed).
 */
function createMutableBoundaryRef(initialBounds: Bounds): {
  boundaryRef: RefObject<HTMLElement | null>;
  setBounds: (bounds: Bounds) => void;
} {
  let current = initialBounds;
  const boundary = document.createElement("div");
  vi.spyOn(boundary, "getBoundingClientRect").mockImplementation(() =>
    toDOMRect(current)
  );
  return {
    boundaryRef: { current: boundary },
    setBounds: (bounds: Bounds) => {
      current = bounds;
    },
  };
}

describe("ResizableFloatingPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1000,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function renderResizablePanel({
    boundaryBounds,
    boundaryRef: providedBoundaryRef,
    onSizeChange = vi.fn(),
    placement = "bottom-end",
  }: {
    boundaryBounds?: Bounds;
    boundaryRef?: RefObject<HTMLElement | null>;
    onSizeChange?: (size: Size) => void;
    placement?: AgentFabPlacement;
  } = {}) {
    const boundaryRef =
      providedBoundaryRef ??
      (boundaryBounds ? createBoundaryRef(boundaryBounds) : undefined);

    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      return (
        <ResizableFloatingPanel
          boundaryRef={boundaryRef}
          minSize={MIN_SIZE}
          placement={placement}
          size={size}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            onSizeChange(nextSize);
          }}
        >
          <div className="agent-chat-panel__header">PXI header</div>
          <span>PXI content</span>
        </ResizableFloatingPanel>
      );
    }

    act(() => {
      root.render(<ResizablePanelHarness />);
    });

    const panel = container.querySelector(".resizable-floating-panel");
    const resizeHandles = Array.from(
      container.querySelectorAll(".resizable-floating-panel__resize-handle")
    );
    const getResizeHandle = (edge: string) =>
      resizeHandles.find((handle) => handle.getAttribute("data-edge") === edge);

    expect(panel).not.toBeNull();
    expect(resizeHandles).toHaveLength(8);
    expect(getResizeHandle("top-left")).not.toBeUndefined();

    return {
      panel: panel!,
      resizeHandle: getResizeHandle("top-left")!,
      resizeHandles,
      getResizeHandle,
    };
  }

  it("places a resize handle on each panel side and corner", () => {
    const { resizeHandles } = renderResizablePanel({
      placement: "bottom-end",
    });

    expect(
      resizeHandles.map((handle) => handle.getAttribute("data-edge"))
    ).toEqual([
      "top",
      "right",
      "bottom",
      "left",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ]);
  });

  it("places content-layer geometry inside the content boundary", () => {
    const { panel } = renderResizablePanel({
      boundaryBounds: {
        height: 850,
        left: 128,
        top: 64,
        width: 960,
      },
      placement: "top-start",
    });

    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("152px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("88px");
  });

  it("re-clamps the panel when the viewport changes", () => {
    const { panel } = renderResizablePanel({
      placement: "bottom-end",
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("356px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("56px");
  });

  it("re-pins a pristine panel to the corner when the boundary grows", () => {
    // Undocking the panel mounts it against a content boundary that is still
    // mid-reflow (reserving the docked panel's width), then widens. A pristine
    // panel must follow the boundary out to the FAB's corner rather than stay
    // stranded in the middle.
    const { boundaryRef, setBounds } = createMutableBoundaryRef({
      height: 1000,
      left: 0,
      top: 0,
      width: 760,
    });
    const { panel } = renderResizablePanel({ boundaryRef });

    // Mounted against the narrow boundary: 760 - 520 - 24 = 216.
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("216px");

    setBounds({ height: 1000, left: 0, top: 0, width: 1200 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Re-pinned to the widened boundary corner: 1200 - 520 - 24 = 656.
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("656px");
  });

  it("keeps a user-positioned panel put when the boundary grows", () => {
    const { boundaryRef, setBounds } = createMutableBoundaryRef({
      height: 1000,
      left: 0,
      top: 0,
      width: 760,
    });
    const { panel } = renderResizablePanel({ boundaryRef });
    Object.assign(panel, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    const header = container.querySelector(".agent-chat-panel__header");
    expect(header).not.toBeNull();

    // Drag the panel — this marks it user-positioned so it stops auto-pinning.
    act(() => {
      dispatchPointerEvent(header!, "pointerdown", {
        clientX: 200,
        clientY: 300,
      });
      dispatchPointerEvent(panel, "pointermove", {
        clientX: 160,
        clientY: 270,
      });
      dispatchPointerEvent(panel, "pointerup", { clientX: 160, clientY: 270 });
    });
    const movedX = (panel as HTMLElement).style.getPropertyValue(
      "--resizable-floating-panel-x"
    );

    setBounds({ height: 1000, left: 0, top: 0, width: 1200 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // The widened boundary must not yank the panel back to the corner.
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe(movedX);
  });

  it("resizes from the panel's top-left corner", () => {
    const onSizeChange = vi.fn();
    const { resizeHandle } = renderResizablePanel({ onSizeChange });
    Object.assign(resizeHandle, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(resizeHandle, "pointerdown", {
        clientX: 656,
        clientY: 256,
      });
      dispatchPointerEvent(resizeHandle, "pointermove", {
        clientX: 606,
        clientY: 216,
      });
      dispatchPointerEvent(resizeHandle, "pointerup", {
        clientX: 606,
        clientY: 216,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 760,
      width: 570,
    });
  });

  it.each([
    {
      edge: "top-right",
      placement: "bottom-start",
      pointerDown: { clientX: 544, clientY: 256 },
      pointerMove: { clientX: 594, clientY: 216 },
      expectedPosition: { x: "24px", y: "216px" },
    },
    {
      edge: "bottom-left",
      placement: "top-end",
      pointerDown: { clientX: 656, clientY: 744 },
      pointerMove: { clientX: 606, clientY: 784 },
      expectedPosition: { x: "606px", y: "24px" },
    },
    {
      edge: "bottom-right",
      placement: "top-start",
      pointerDown: { clientX: 544, clientY: 744 },
      pointerMove: { clientX: 594, clientY: 784 },
      expectedPosition: { x: "24px", y: "24px" },
    },
  ] satisfies {
    edge: string;
    expectedPosition: { x: string; y: string };
    placement: AgentFabPlacement;
    pointerDown: { clientX: number; clientY: number };
    pointerMove: { clientX: number; clientY: number };
  }[])(
    "resizes from the panel's $edge corner",
    ({ edge, expectedPosition, placement, pointerDown, pointerMove }) => {
      const onSizeChange = vi.fn();
      const { getResizeHandle, panel } = renderResizablePanel({
        onSizeChange,
        placement,
      });
      const resizeHandle = getResizeHandle(edge);
      expect(resizeHandle).not.toBeUndefined();
      Object.assign(resizeHandle!, {
        hasPointerCapture: vi.fn(() => true),
        releasePointerCapture: vi.fn(),
        setPointerCapture: vi.fn(),
      });

      act(() => {
        dispatchPointerEvent(resizeHandle!, "pointerdown", pointerDown);
        dispatchPointerEvent(resizeHandle!, "pointermove", pointerMove);
        dispatchPointerEvent(resizeHandle!, "pointerup", pointerMove);
      });

      expect(onSizeChange).toHaveBeenLastCalledWith({
        height: 760,
        width: 570,
      });
      expect(
        (panel as HTMLElement).style.getPropertyValue(
          "--resizable-floating-panel-x"
        )
      ).toBe(expectedPosition.x);
      expect(
        (panel as HTMLElement).style.getPropertyValue(
          "--resizable-floating-panel-y"
        )
      ).toBe(expectedPosition.y);
    }
  );

  it.each([
    {
      edge: "top",
      placement: "bottom-start",
      pointerDown: { clientX: 284, clientY: 256 },
      pointerMove: { clientX: 334, clientY: 216 },
      expectedPosition: { x: "24px", y: "216px" },
      expectedSize: { height: 760, width: 520 },
    },
    {
      edge: "right",
      placement: "top-start",
      pointerDown: { clientX: 544, clientY: 384 },
      pointerMove: { clientX: 594, clientY: 430 },
      expectedPosition: { x: "24px", y: "24px" },
      expectedSize: { height: 720, width: 570 },
    },
    {
      edge: "bottom",
      placement: "top-start",
      pointerDown: { clientX: 284, clientY: 744 },
      pointerMove: { clientX: 334, clientY: 784 },
      expectedPosition: { x: "24px", y: "24px" },
      expectedSize: { height: 760, width: 520 },
    },
    {
      edge: "left",
      placement: "top-end",
      pointerDown: { clientX: 656, clientY: 384 },
      pointerMove: { clientX: 606, clientY: 430 },
      expectedPosition: { x: "606px", y: "24px" },
      expectedSize: { height: 720, width: 570 },
    },
  ] satisfies {
    edge: string;
    expectedPosition: { x: string; y: string };
    expectedSize: Size;
    placement: AgentFabPlacement;
    pointerDown: { clientX: number; clientY: number };
    pointerMove: { clientX: number; clientY: number };
  }[])(
    "resizes from the panel's $edge edge",
    ({
      edge,
      expectedPosition,
      expectedSize,
      placement,
      pointerDown,
      pointerMove,
    }) => {
      const onSizeChange = vi.fn();
      const { getResizeHandle, panel } = renderResizablePanel({
        onSizeChange,
        placement,
      });
      const resizeHandle = getResizeHandle(edge);
      expect(resizeHandle).not.toBeUndefined();
      Object.assign(resizeHandle!, {
        hasPointerCapture: vi.fn(() => true),
        releasePointerCapture: vi.fn(),
        setPointerCapture: vi.fn(),
      });

      act(() => {
        dispatchPointerEvent(resizeHandle!, "pointerdown", pointerDown);
        dispatchPointerEvent(resizeHandle!, "pointermove", pointerMove);
        dispatchPointerEvent(resizeHandle!, "pointerup", pointerMove);
      });

      expect(onSizeChange).toHaveBeenLastCalledWith(expectedSize);
      expect(
        (panel as HTMLElement).style.getPropertyValue(
          "--resizable-floating-panel-x"
        )
      ).toBe(expectedPosition.x);
      expect(
        (panel as HTMLElement).style.getPropertyValue(
          "--resizable-floating-panel-y"
        )
      ).toBe(expectedPosition.y);
    }
  );

  it("resizes with the keyboard when the resize handle is focused", () => {
    const onSizeChange = vi.fn();
    const { resizeHandle } = renderResizablePanel({ onSizeChange });

    act(() => {
      (resizeHandle as HTMLElement).focus();
    });

    expect(document.activeElement).toBe(resizeHandle);

    act(() => {
      resizeHandle.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })
      );
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 720,
      width: 544,
    });
  });

  it("moves the panel by dragging the header without persisting size", () => {
    const onSizeChange = vi.fn();
    const { panel } = renderResizablePanel({ onSizeChange });
    const header = container.querySelector(".agent-chat-panel__header");
    expect(header).not.toBeNull();
    Object.assign(panel, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(header!, "pointerdown", {
        clientX: 800,
        clientY: 300,
      });
      dispatchPointerEvent(panel, "pointermove", {
        clientX: 760,
        clientY: 270,
      });
      dispatchPointerEvent(panel, "pointerup", {
        clientX: 760,
        clientY: 270,
      });
    });

    expect(onSizeChange).not.toHaveBeenCalled();
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("616px");
  });

  it("keeps the panel location after resizing a moved panel", () => {
    const onSizeChange = vi.fn();
    const { panel, resizeHandle } = renderResizablePanel({
      onSizeChange,
    });
    const header = container.querySelector(".agent-chat-panel__header");
    expect(header).not.toBeNull();
    Object.assign(panel, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    Object.assign(resizeHandle, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(header!, "pointerdown", {
        clientX: 800,
        clientY: 300,
      });
      dispatchPointerEvent(panel, "pointermove", {
        clientX: 760,
        clientY: 270,
      });
      dispatchPointerEvent(panel, "pointerup", {
        clientX: 760,
        clientY: 270,
      });
    });

    act(() => {
      dispatchPointerEvent(resizeHandle, "pointerdown", {
        clientX: 616,
        clientY: 226,
      });
      dispatchPointerEvent(resizeHandle, "pointermove", {
        clientX: 566,
        clientY: 186,
      });
      dispatchPointerEvent(resizeHandle, "pointerup", {
        clientX: 566,
        clientY: 186,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 760,
      width: 570,
    });
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("566px");
  });

  it("commits movement when pointer capture is lost", () => {
    const { panel } = renderResizablePanel();
    const header = container.querySelector(".agent-chat-panel__header");
    expect(header).not.toBeNull();
    Object.assign(panel, {
      hasPointerCapture: vi.fn(() => false),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(header!, "pointerdown", {
        clientX: 800,
        clientY: 300,
      });
      dispatchPointerEvent(panel, "pointermove", {
        clientX: 840,
        clientY: 330,
      });
      panel.dispatchEvent(new Event("lostpointercapture", { bubbles: true }));
    });

    expect(panel.getAttribute("data-moving")).toBeNull();
  });
});
