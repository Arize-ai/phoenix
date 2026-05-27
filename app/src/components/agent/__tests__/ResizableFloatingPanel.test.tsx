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
    floatingAction,
    layer = "content",
    onSizeChange = vi.fn(),
    placement = "bottom-end",
  }: {
    floatingAction?: ReactNode;
    layer?: "content" | "modal";
    onSizeChange?: (size: Size) => void;
    placement?: AgentFabPlacement;
  } = {}) {
    function ResizablePanelHarness() {
      const [size, setSize] = useState(() => ({ ...DEFAULT_SIZE }));
      return (
        <ResizableFloatingPanel
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

  it("places a resize handle on the panel's top-left corner", () => {
    const { resizeHandle } = renderResizablePanel({
      placement: "bottom-end",
    });

    expect(resizeHandle.getAttribute("data-edge")).toBe("top-left");
  });

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
    ).toBe("704px");
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
        clientX: 704,
        clientY: 226,
      });
      dispatchPointerEvent(resizeHandle, "pointermove", {
        clientX: 654,
        clientY: 186,
      });
      dispatchPointerEvent(resizeHandle, "pointerup", {
        clientX: 654,
        clientY: 186,
      });
    });

    expect(onSizeChange).toHaveBeenLastCalledWith({
      height: 760,
      width: 470,
    });
    expect(
      (panel as HTMLElement).style.getPropertyValue(
        "--resizable-floating-panel-x"
      )
    ).toBe("654px");
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
