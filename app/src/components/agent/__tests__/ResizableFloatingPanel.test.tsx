import { act, useState, type ReactNode } from "react";
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
    floatingAction,
    initialSize = DEFAULT_SIZE,
    layer = "content",
    onSizeChange = vi.fn(),
    placement = "bottom-end",
  }: {
    boundaryRef?: React.RefObject<HTMLElement | null>;
    floatingAction?: ReactNode;
    initialSize?: Size;
    layer?: "content" | "modal";
    onSizeChange?: (size: Size) => void;
    placement?: AgentFabPlacement;
  } = {}) {
    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...initialSize }));
      return (
        <ResizableFloatingPanel
          boundaryRef={boundaryRef}
          floatingAction={floatingAction}
          layer={layer}
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
      '[aria-label="Resize assistant"]'
    );

    expect(panel).not.toBeNull();
    expect(resizeHandle).not.toBeNull();

    return {
      panel: panel!,
      resizeHandle: resizeHandle!,
    };
  }

  it("matches the panel CSS min width to the clamped boundary width", () => {
    const boundary = document.createElement("div");
    Object.defineProperty(boundary, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 950,
        height: 900,
        left: 100,
        right: 420,
        top: 50,
        width: 320,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }),
    });
    const boundaryRef = { current: boundary };

    const { panel } = renderResizablePanel({
      boundaryRef,
      initialSize: {
        width: 720,
        height: 720,
      },
    });

    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-min-width"
      )
    ).toBe("248px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-width"
      )
    ).toBe("248px");
  });

  it("does not render resize handles in fullscreen mode", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });

    act(() => {
      root.render(
        <ResizableFloatingPanel
          minSize={MIN_SIZE}
          placement="bottom-end"
          size={DEFAULT_SIZE}
        >
          <div className="agent-chat-panel__header">PXI header</div>
          <span>PXI content</span>
        </ResizableFloatingPanel>
      );
    });

    expect(
      container.querySelector('[aria-label="Resize assistant"]')
    ).toBeNull();
  });

  it.each([
    ["bottom-end", "top-left"],
    ["bottom-start", "top-right"],
    ["top-end", "bottom-left"],
    ["top-start", "bottom-right"],
  ] as const)(
    "places the resize handle at the corner opposite the FAB for %s placement",
    (placement, expectedEdge) => {
      const { resizeHandle } = renderResizablePanel({ placement });
      expect(resizeHandle.getAttribute("data-edge")).toBe(expectedEdge);
    }
  );

  it("uses fixed positioning in the modal layer", () => {
    const { panel } = renderResizablePanel({ layer: "modal" });

    expect(panel.getAttribute("data-layer")).toBe("modal");
    expect(getComputedStyle(panel).position).toBe("fixed");
  });

  it("renders the floating action attached below the panel", () => {
    renderResizablePanel({
      floatingAction: <button aria-label="Close assistant">PXI</button>,
    });

    const floatingAction = container.querySelector(
      ".resizable-floating-panel__floating-action"
    );
    expect(floatingAction).not.toBeNull();
    expect(
      floatingAction?.querySelector('button[aria-label="Close assistant"]')
    ).not.toBeNull();
    expect(floatingAction?.getAttribute("data-placement")).toBe("bottom-end");
  });

  it("anchors the panel and floating action to the top-start corner", () => {
    const { panel } = renderResizablePanel({
      floatingAction: <button aria-label="Close assistant">PXI</button>,
      placement: "top-start",
    });

    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("36px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("68px");
  });

  it("clamps the panel so the lower floating action stays onscreen", () => {
    const { panel } = renderResizablePanel({
      floatingAction: <button aria-label="Close assistant">PXI</button>,
    });

    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("212px");
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
        clientX: 744,
        clientY: 256,
      });
      dispatchPointerEvent(resizeHandle, "pointermove", {
        clientX: 694,
        clientY: 216,
      });
      dispatchPointerEvent(resizeHandle, "pointerup", {
        clientX: 694,
        clientY: 216,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 760,
      width: 470,
    });
  });

  it("focuses the resize handle on pointer resize so keyboard resize can follow", () => {
    const onSizeChange = vi.fn();
    const { resizeHandle } = renderResizablePanel({ onSizeChange });
    Object.assign(resizeHandle, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(resizeHandle, "pointerdown", {
        clientX: 744,
        clientY: 256,
      });
      dispatchPointerEvent(resizeHandle, "pointerup", {
        clientX: 744,
        clientY: 256,
      });
    });

    expect(document.activeElement).toBe(resizeHandle);

    act(() => {
      resizeHandle.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })
      );
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 720,
      width: 444,
    });
  });

  it("snaps the panel back to the nearest corner after dragging the header", () => {
    const onSizeChange = vi.fn();
    const { panel } = renderResizablePanel({
      floatingAction: <button aria-label="Close assistant">PXI</button>,
      onSizeChange,
    });
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
    ).toBe("744px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("212px");
  });

  it("updates the snapped corner after dragging the header across the viewport", () => {
    const onSizeChange = vi.fn();
    const onPlacementChange = vi.fn();
    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      const [placement, setPlacement] = useState<AgentFabPlacement>(
        "bottom-end"
      );
      return (
        <ResizableFloatingPanel
          floatingAction={<button aria-label="Close assistant">PXI</button>}
          minSize={MIN_SIZE}
          onPlacementChange={(nextPlacement) => {
            setPlacement(nextPlacement);
            onPlacementChange(nextPlacement);
          }}
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
    const header = container.querySelector(".agent-chat-panel__header");
    expect(panel).not.toBeNull();
    expect(header).not.toBeNull();
    Object.assign(panel!, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(header!, "pointerdown", {
        clientX: 800,
        clientY: 300,
      });
      dispatchPointerEvent(panel!, "pointermove", {
        clientX: 200,
        clientY: 120,
      });
      dispatchPointerEvent(panel!, "pointerup", {
        clientX: 200,
        clientY: 120,
      });
    });

    expect(onSizeChange).not.toHaveBeenCalled();
    expect(onPlacementChange).toHaveBeenLastCalledWith("top-start");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("36px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("68px");
  });

  it("keeps the snapped corner after resizing", () => {
    const onSizeChange = vi.fn();
    const { panel, resizeHandle } = renderResizablePanel({
      onSizeChange,
    });
    Object.assign(resizeHandle, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(resizeHandle, "pointerdown", {
        clientX: 744,
        clientY: 212,
      });
      dispatchPointerEvent(resizeHandle, "pointermove", {
        clientX: 694,
        clientY: 172,
      });
      dispatchPointerEvent(resizeHandle, "pointerup", {
        clientX: 694,
        clientY: 172,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 804,
      width: 470,
    });
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("694px");
  });

  it("snaps a resized open panel to the bottom corner when dragged along the bottom edge", () => {
    const onPlacementChange = vi.fn();

    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      const [placement, setPlacement] = useState<AgentFabPlacement>(
        "bottom-end"
      );

      return (
        <ResizableFloatingPanel
          minSize={MIN_SIZE}
          onPlacementChange={(nextPlacement) => {
            setPlacement(nextPlacement);
            onPlacementChange(nextPlacement);
          }}
          placement={placement}
          size={size}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
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
    const header = container.querySelector(".agent-chat-panel__header");
    const resizeHandle = container.querySelector(
      '[aria-label="Resize assistant"]'
    );
    expect(panel).not.toBeNull();
    expect(header).not.toBeNull();
    expect(resizeHandle).not.toBeNull();

    Object.assign(resizeHandle!, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    Object.assign(panel!, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(resizeHandle!, "pointerdown", {
        clientX: 744,
        clientY: 212,
      });
      dispatchPointerEvent(resizeHandle!, "pointermove", {
        clientX: 694,
        clientY: 172,
      });
      dispatchPointerEvent(resizeHandle!, "pointerup", {
        clientX: 694,
        clientY: 172,
      });
    });

    act(() => {
      dispatchPointerEvent(header!, "pointerdown", {
        clientX: 760,
        clientY: 220,
      });
      dispatchPointerEvent(panel!, "pointermove", {
        clientX: 160,
        clientY: 220,
      });
      dispatchPointerEvent(panel!, "pointerup", {
        clientX: 160,
        clientY: 220,
      });
    });

    expect(onPlacementChange).toHaveBeenLastCalledWith("bottom-start");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("172px");
  });

  it("lets the attached floating action handle clicks", () => {
    const onClose = vi.fn();
    renderResizablePanel({
      floatingAction: (
        <button aria-label="Close assistant" onClick={onClose}>
          PXI
        </button>
      ),
    });
    const closeButton = container.querySelector(
      'button[aria-label="Close assistant"]'
    );
    expect(closeButton).not.toBeNull();

    act(() => {
      closeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets the attached floating action drag the panel to another corner", () => {
    const onPlacementChange = vi.fn();
    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      const [placement, setPlacement] = useState<AgentFabPlacement>(
        "bottom-end"
      );
      return (
        <ResizableFloatingPanel
          floatingAction={<button aria-label="Close assistant">PXI</button>}
          minSize={MIN_SIZE}
          onPlacementChange={(nextPlacement) => {
            setPlacement(nextPlacement);
            onPlacementChange(nextPlacement);
          }}
          placement={placement}
          size={size}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
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
    const floatingAction = container.querySelector(
      ".resizable-floating-panel__floating-action"
    );
    expect(panel).not.toBeNull();
    expect(floatingAction).not.toBeNull();
    Object.assign(floatingAction!, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(floatingAction!, "pointerdown", {
        clientX: 781,
        clientY: 969,
      });
      dispatchPointerEvent(floatingAction!, "pointermove", {
        clientX: 210,
        clientY: 120,
      });
      dispatchPointerEvent(floatingAction!, "pointerup", {
        clientX: 210,
        clientY: 120,
      });
    });

    expect(onPlacementChange).toHaveBeenLastCalledWith("top-start");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("36px");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-y"
      )
    ).toBe("68px");
  });

  it("lets the attached floating action drag even when the child consumes pointer events", () => {
    const onPlacementChange = vi.fn();
    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      const [placement, setPlacement] = useState<AgentFabPlacement>(
        "bottom-end"
      );
      return (
        <ResizableFloatingPanel
          floatingAction={
            <button
              aria-label="Close assistant"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              PXI
            </button>
          }
          minSize={MIN_SIZE}
          onPlacementChange={(nextPlacement) => {
            setPlacement(nextPlacement);
            onPlacementChange(nextPlacement);
          }}
          placement={placement}
          size={size}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
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
    const floatingAction = container.querySelector(
      ".resizable-floating-panel__floating-action"
    );
    const closeButton = container.querySelector(
      'button[aria-label="Close assistant"]'
    );
    expect(panel).not.toBeNull();
    expect(floatingAction).not.toBeNull();
    expect(closeButton).not.toBeNull();
    Object.assign(floatingAction!, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(closeButton!, "pointerdown", {
        clientX: 781,
        clientY: 969,
      });
      dispatchPointerEvent(closeButton!, "pointermove", {
        clientX: 210,
        clientY: 120,
      });
      dispatchPointerEvent(closeButton!, "pointerup", {
        clientX: 210,
        clientY: 120,
      });
    });

    expect(onPlacementChange).toHaveBeenLastCalledWith("top-start");
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("36px");
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
