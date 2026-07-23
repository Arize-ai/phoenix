import { act, type PointerEvent as ReactPointerEvent } from "react";
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
    vi.useRealTimers();
  });

  function renderPositioner({
    onClick = vi.fn(),
    onActivate = vi.fn(),
    onPlacementChange = vi.fn(),
    placement = "bottom-end",
    stopPointerPropagation = false,
  }: {
    onClick?: () => void;
    onActivate?: () => void;
    onPlacementChange?: (placement: AgentFabPlacement) => void;
    placement?: AgentFabPlacement;
    stopPointerPropagation?: boolean;
  } = {}) {
    const stopPropagation = (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (stopPointerPropagation) {
        event.stopPropagation();
      }
    };

    act(() => {
      root.render(
        <AgentFabPositioner
          placement={placement}
          size={{ width: 58, height: 36 }}
          onActivate={onActivate}
          onPlacementChange={onPlacementChange}
        >
          <button
            type="button"
            onClick={onClick}
            onPointerCancel={stopPropagation}
            onPointerDown={stopPropagation}
            onPointerMove={stopPropagation}
            onPointerUp={stopPropagation}
          >
            PXI
          </button>
        </AgentFabPositioner>
      );
    });

    const positioner = container.querySelector<HTMLElement>(
      ".agent-chat-widget-positioner"
    );
    const button = container.querySelector("button");
    expect(positioner).not.toBeNull();
    expect(button).not.toBeNull();

    Object.assign(positioner!, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
    });
    vi.spyOn(positioner!, "getBoundingClientRect").mockReturnValue({
      bottom: 976,
      height: 36,
      left: 1106,
      right: 1164,
      top: 940,
      width: 58,
      x: 1106,
      y: 940,
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
        clientX: 1135,
        clientY: 958,
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

  it("supports dragging when trigger children consume pointer events", () => {
    const onPlacementChange = vi.fn();
    const { button } = renderPositioner({
      onPlacementChange,
      stopPointerPropagation: true,
    });

    act(() => {
      dispatchPointerEvent(button, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(button, "pointermove", {
        clientX: 150,
        clientY: 140,
      });
      dispatchPointerEvent(button, "pointerup", {
        clientX: 150,
        clientY: 140,
      });
    });

    expect(onPlacementChange).toHaveBeenCalledWith("top-start");
  });

  it("activates on a pure pointer release", () => {
    const onActivate = vi.fn();
    const { button } = renderPositioner({ onActivate });

    act(() => {
      dispatchPointerEvent(button, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(button, "pointerup", {
        clientX: 1135,
        clientY: 958,
      });
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("does not move on click jitter below the drag threshold", () => {
    const onActivate = vi.fn();
    const { button, positioner } = renderPositioner({ onActivate });
    const initialTransform = positioner.style.transform;

    act(() => {
      dispatchPointerEvent(button, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(button, "pointermove", {
        clientX: 1137,
        clientY: 960,
      });
      dispatchPointerEvent(button, "pointerup", {
        clientX: 1138,
        clientY: 960,
      });
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(positioner.style.transform).toBe(initialTransform);
  });

  it("does not activate after a drag", () => {
    const onActivate = vi.fn();
    const { button } = renderPositioner({ onActivate });

    act(() => {
      dispatchPointerEvent(button, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(button, "pointermove", {
        clientX: 150,
        clientY: 140,
      });
      dispatchPointerEvent(button, "pointerup", {
        clientX: 150,
        clientY: 140,
      });
    });

    expect(onActivate).not.toHaveBeenCalled();
  });

  it("suppresses the opening click after a drag", () => {
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 1135,
        clientY: 958,
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
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(positioner, "pointerup", {
        clientX: 1135,
        clientY: 958,
      });
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("captures the pointer while a drag is pending without blocking normal click", () => {
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(button, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(button, "pointerup", {
        clientX: 1135,
        clientY: 958,
      });
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(positioner.setPointerCapture).toHaveBeenCalledWith(1);
    expect(positioner.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps pointer capture while dragging", () => {
    const { positioner } = renderPositioner();

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(positioner, "pointermove", {
        clientX: 900,
        clientY: 730,
      });
    });

    expect(positioner.setPointerCapture).toHaveBeenCalledWith(1);
    expect(positioner.setPointerCapture).toHaveBeenCalledTimes(1);
  });

  it("finishes a drag when pointer capture is lost", () => {
    const onPlacementChange = vi.fn();
    const { positioner } = renderPositioner({ onPlacementChange });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 1135,
        clientY: 958,
      });
      dispatchPointerEvent(positioner, "pointermove", {
        clientX: 150,
        clientY: 140,
      });
      dispatchPointerEvent(positioner, "lostpointercapture", {
        clientX: 150,
        clientY: 140,
      });
    });

    expect(onPlacementChange).toHaveBeenCalledWith("top-start");
    expect(positioner.getAttribute("data-dragging")).toBeNull();
  });

  it("does not suppress a later click when the drag release click was not emitted", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const { button, positioner } = renderPositioner({ onClick });

    act(() => {
      dispatchPointerEvent(positioner, "pointerdown", {
        clientX: 1135,
        clientY: 958,
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
