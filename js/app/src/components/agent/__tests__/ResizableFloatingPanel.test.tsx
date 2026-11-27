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
    boundaryRef,
    onSizeChange = vi.fn(),
    placement = "bottom-end",
  }: {
    boundaryRef?: RefObject<HTMLElement | null>;
    onSizeChange?: (size: Size) => void;
    placement?: AgentFabPlacement;
  } = {}) {
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
    const resizeHandle = container.querySelector(
      '.resizable-floating-panel__resize-handle[data-edge="top-left"]'
    );
    expect(panel).not.toBeNull();
    expect(resizeHandle).not.toBeNull();
    return { panel: panel!, resizeHandle: resizeHandle! };
  }

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
