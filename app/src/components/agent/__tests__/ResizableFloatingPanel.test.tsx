import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentFabPlacement } from "@phoenix/store/agentStore";
import type { Size } from "@phoenix/types/geometry";

import { ResizableFloatingPanel } from "../ResizableFloatingPanel";

const DEFAULT_SIZE: Size = {
  width: 420,
  height: 720,
};

const MIN_SIZE: Size = {
  width: 360,
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

function mockRect(element: Element, rect: Partial<DOMRect>) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    bottom: rect.bottom ?? 0,
    height: rect.height ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? 0,
    top: rect.top ?? 0,
    width: rect.width ?? 0,
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("ResizableFloatingPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
    onSizeChange = vi.fn(),
    placement = "bottom-end",
  }: {
    onSizeChange?: (size: Size) => void;
    placement?: AgentFabPlacement;
  } = {}) {
    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      return (
        <ResizableFloatingPanel
          minSize={MIN_SIZE}
          placement={placement}
          size={size}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            onSizeChange(nextSize);
          }}
        >
          <span>PXI content</span>
        </ResizableFloatingPanel>
      );
    }

    act(() => {
      root.render(<ResizablePanelHarness />);
    });

    const panel = container.querySelector(".resizable-floating-panel");
    const widthHandle = container.querySelector(
      '[aria-label="Resize assistant width"]'
    );
    const heightHandle = container.querySelector(
      '[aria-label="Resize assistant height"]'
    );

    expect(panel).not.toBeNull();
    expect(widthHandle).not.toBeNull();
    expect(heightHandle).not.toBeNull();

    return {
      heightHandle: heightHandle!,
      panel: panel!,
      widthHandle: widthHandle!,
    };
  }

  it("places resize handles on the bottom-end panel's inner edges", () => {
    const { heightHandle, widthHandle } = renderResizablePanel({
      placement: "bottom-end",
    });

    expect(widthHandle.getAttribute("data-edge")).toBe("left");
    expect(heightHandle.getAttribute("data-edge")).toBe("top");
  });

  it("places resize handles on the top-start panel's inner edges", () => {
    const { heightHandle, widthHandle } = renderResizablePanel({
      placement: "top-start",
    });

    expect(widthHandle.getAttribute("data-edge")).toBe("right");
    expect(heightHandle.getAttribute("data-edge")).toBe("bottom");
  });

  it("resizes horizontally from the bottom-end panel's left edge", () => {
    const onSizeChange = vi.fn();
    const { panel, widthHandle } = renderResizablePanel({ onSizeChange });
    mockRect(container, {
      bottom: 900,
      height: 900,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
    });
    mockRect(panel, {
      bottom: 884,
      height: 720,
      left: 564,
      right: 984,
      top: 164,
      width: 420,
    });
    Object.assign(widthHandle, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(widthHandle, "pointerdown", {
        clientX: 564,
        clientY: 500,
      });
      dispatchPointerEvent(widthHandle, "pointermove", {
        clientX: 514,
        clientY: 500,
      });
      dispatchPointerEvent(widthHandle, "pointerup", {
        clientX: 514,
        clientY: 500,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 720,
      width: 470,
    });
  });

  it("resizes vertically from the bottom-end panel's top edge", () => {
    const onSizeChange = vi.fn();
    const { heightHandle, panel } = renderResizablePanel({ onSizeChange });
    mockRect(container, {
      bottom: 900,
      height: 900,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
    });
    mockRect(panel, {
      bottom: 884,
      height: 720,
      left: 564,
      right: 984,
      top: 164,
      width: 420,
    });
    Object.assign(heightHandle, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(heightHandle, "pointerdown", {
        clientX: 800,
        clientY: 164,
      });
      dispatchPointerEvent(heightHandle, "pointermove", {
        clientX: 800,
        clientY: 124,
      });
      dispatchPointerEvent(heightHandle, "pointerup", {
        clientX: 800,
        clientY: 124,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 760,
      width: 420,
    });
  });
});
