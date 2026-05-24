import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgentChatHeader,
  DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  FloatingAgentChatFrame,
} from "../AgentChatPanelView";

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

describe("AgentChatHeader", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("switches from pinned to floating mode", () => {
    const onPositionChange = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <AgentChatHeader
            sessionDisplayName="PXI"
            orderedSessions={[]}
            activeSessionId={null}
            showSessionHistory={false}
            position="pinned"
            onSelectSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onCreateSession={vi.fn()}
            onPositionChange={onPositionChange}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    const toggleButton = container.querySelector(
      'button[aria-label="Switch assistant to floating panel"]'
    );

    expect(toggleButton).not.toBeNull();

    act(() => {
      toggleButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPositionChange).toHaveBeenCalledWith("detached");
  });

  it("switches from floating mode back to pinned", () => {
    const onPositionChange = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <AgentChatHeader
            sessionDisplayName="PXI"
            orderedSessions={[]}
            activeSessionId={null}
            showSessionHistory={false}
            position="detached"
            onSelectSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onCreateSession={vi.fn()}
            onPositionChange={onPositionChange}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    const toggleButton = container.querySelector(
      'button[aria-label="Pin assistant to side"]'
    );

    expect(toggleButton).not.toBeNull();

    act(() => {
      toggleButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPositionChange).toHaveBeenCalledWith("pinned");
  });
});

describe("FloatingAgentChatFrame", () => {
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

  function renderFloatingFrame({
    onSizeChange = vi.fn(),
    placement = "bottom-end",
  }: {
    onSizeChange?: (size: { height: number; width: number }) => void;
    placement?: "bottom-end" | "bottom-start" | "top-end" | "top-start";
  } = {}) {
    function FloatingFrameHarness() {
      const [size, setSize] = useState(() => ({
        ...DEFAULT_FLOATING_AGENT_CHAT_SIZE,
      }));
      return (
        <FloatingAgentChatFrame
          placement={placement}
          size={size}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            onSizeChange(nextSize);
          }}
        >
          <span>PXI content</span>
        </FloatingAgentChatFrame>
      );
    }

    act(() => {
      root.render(<FloatingFrameHarness />);
    });

    const panel = container.querySelector(".floating-agent-chat-panel");
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
    const { heightHandle, widthHandle } = renderFloatingFrame({
      placement: "bottom-end",
    });

    expect(widthHandle.getAttribute("data-edge")).toBe("left");
    expect(heightHandle.getAttribute("data-edge")).toBe("top");
  });

  it("places resize handles on the top-start panel's inner edges", () => {
    const { heightHandle, widthHandle } = renderFloatingFrame({
      placement: "top-start",
    });

    expect(widthHandle.getAttribute("data-edge")).toBe("right");
    expect(heightHandle.getAttribute("data-edge")).toBe("bottom");
  });

  it("resizes horizontally from the bottom-end panel's left edge", () => {
    const onSizeChange = vi.fn();
    const { panel, widthHandle } = renderFloatingFrame({ onSizeChange });
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
    const { heightHandle, panel } = renderFloatingFrame({ onSizeChange });
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
