import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentFabPlacement } from "@phoenix/store/agentStore";

import { AgentFabPositioner } from "../AgentFabPositioner";

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

describe("AgentFabPositioner", () => {
  let boundary: HTMLDivElement;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    boundary = document.createElement("div");
    container = document.createElement("div");
    document.body.appendChild(boundary);
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(boundary, "getBoundingClientRect").mockReturnValue({
      bottom: 800,
      height: 700,
      left: 100,
      right: 1000,
      top: 100,
      width: 900,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    boundary.remove();
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function renderPositioner({
    onClick = vi.fn(),
    onPlacementChange = vi.fn(),
    placement = "bottom-end",
  }: {
    onClick?: () => void;
    onPlacementChange?: (placement: AgentFabPlacement) => void;
    placement?: AgentFabPlacement;
  } = {}) {
    act(() => {
      root.render(
        <AgentFabPositioner
          boundaryRef={{ current: boundary }}
          placement={placement}
          size={{ width: 58, height: 36 }}
          onPlacementChange={onPlacementChange}
        >
          <button type="button" onClick={onClick}>
            PXI
          </button>
        </AgentFabPositioner>
      );
    });

    const positioner = container.querySelector(".agent-chat-widget-positioner");
    const button = container.querySelector("button");
    expect(positioner).not.toBeNull();
    expect(button).not.toBeNull();

    Object.assign(positioner!, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
    });
    vi.spyOn(positioner!, "getBoundingClientRect").mockReturnValue({
      bottom: 800,
      height: 36,
      left: 906,
      right: 964,
      top: 740,
      width: 58,
      x: 906,
      y: 740,
      toJSON: () => ({}),
    } as DOMRect);

    return {
      button: button!,
      positioner: positioner!,
    };
  }

  it("updates placement to the nearest corner after a rAF-driven drag", () => {
    const onPlacementChange = vi.fn();
    const { positioner } = renderPositioner({ onPlacementChange });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(positioner, "pointermove", {
        clientX: 150,
        clientY: 140,
      });
      dispatchPointerEvent(positioner, "pointerup", {
        clientX: 150,
        clientY: 140,
      });
    });

    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(onPlacementChange).toHaveBeenCalledWith("top-start");
  });

  it("suppresses the opening click after a drag", () => {
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(positioner, "pointermove", {
        clientX: 150,
        clientY: 140,
      });
      dispatchPointerEvent(positioner, "pointerup", {
        clientX: 150,
        clientY: 140,
      });
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a normal click available when the pointer was not dragged", () => {
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(positioner, "pointerup", {
        clientX: 935,
        clientY: 758,
      });
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not capture the pointer before the user starts dragging", () => {
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(button, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(button, "pointerup", {
        clientX: 935,
        clientY: 758,
      });
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(positioner.setPointerCapture).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("captures the pointer once dragging starts", () => {
    const { positioner } = renderPositioner();

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(positioner, "pointermove", {
        clientX: 900,
        clientY: 730,
      });
    });

    expect(positioner.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it("does not suppress a later click when the drag release click was not emitted", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(positioner, "pointermove", {
        clientX: 150,
        clientY: 140,
      });
      dispatchPointerEvent(positioner, "pointerup", {
        clientX: 150,
        clientY: 140,
      });
      vi.runOnlyPendingTimers();
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
