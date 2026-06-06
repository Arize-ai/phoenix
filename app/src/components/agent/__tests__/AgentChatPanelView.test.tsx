import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MODAL_OVERLAY_CLASS_NAME,
  MODAL_PORTAL_CONTAINER_ATTR,
} from "@phoenix/components/core/overlay/constants";

import { AgentChatHeader, FloatingAgentChatFrame } from "../AgentChatPanelView";

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
    document
      .querySelectorAll(`.${MODAL_OVERLAY_CLASS_NAME}`)
      .forEach((element) => element.remove());
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

  it("disables docking when position changes are unavailable", () => {
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
            isPositionChangeDisabled
            onSelectSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onCreateSession={vi.fn()}
            onPositionChange={onPositionChange}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    const toggleButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Pin assistant to side"]'
    );

    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.disabled).toBe(true);

    act(() => {
      toggleButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("anchors a forced-floating panel to the viewport, not a mid-reflow boundary", () => {
    // Reproduces the docked -> drawer transition: when the panel is forced to
    // float on the content layer, the boundary element can still report its
    // pre-reflow (narrower) width, which used to strand the panel in the middle
    // of the screen. Forcing the panel to anchor to the viewport pins it to the
    // FAB's resting corner instead.
    const PANEL_WIDTH = 520;
    const MARGIN = 24;
    const VIEWPORT_WIDTH = 1440;
    const VIEWPORT_HEIGHT = 900;
    // Simulates the content boundary before the docked panel's width reflows
    // away — its right edge stops ~420px short of the viewport edge.
    const NARROW_BOUNDARY_WIDTH = 1000;

    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = window.visualViewport;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: VIEWPORT_WIDTH,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: VIEWPORT_HEIGHT,
    });
    // Fall back to innerWidth/innerHeight inside getViewportBounds and let the
    // panel's `window.visualViewport?.addEventListener` calls short-circuit.
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });

    const boundary = document.createElement("div");
    document.body.appendChild(boundary);
    boundary.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: NARROW_BOUNDARY_WIDTH,
        bottom: VIEWPORT_HEIGHT,
        width: NARROW_BOUNDARY_WIDTH,
        height: VIEWPORT_HEIGHT,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const boundaryRef = { current: boundary };

    const readPanelX = () => {
      const panel = container.querySelector<HTMLElement>(
        ".resizable-floating-panel"
      );
      expect(panel).not.toBeNull();
      return parseFloat(
        panel!.style.getPropertyValue("--resizable-floating-panel-x")
      );
    };

    try {
      // Without forced floating the panel follows the (narrow) boundary corner.
      act(() => {
        root.render(
          <FloatingAgentChatFrame
            boundaryRef={boundaryRef}
            layer="content"
            placement="bottom-end"
          >
            <span>PXI content</span>
          </FloatingAgentChatFrame>
        );
      });
      expect(readPanelX()).toBe(NARROW_BOUNDARY_WIDTH - PANEL_WIDTH - MARGIN);

      // Unmount so the next render is a fresh mount, matching the real
      // docked -> drawer transition where the floating panel mounts anew.
      act(() => {
        root.render(<div />);
      });

      // Forced floating ignores the boundary and pins to the viewport corner.
      act(() => {
        root.render(
          <FloatingAgentChatFrame
            boundaryRef={boundaryRef}
            layer="content"
            placement="bottom-end"
            isForcedFloating
          >
            <span>PXI content</span>
          </FloatingAgentChatFrame>
        );
      });
      expect(readPanelX()).toBe(VIEWPORT_WIDTH - PANEL_WIDTH - MARGIN);
    } finally {
      boundary.remove();
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: originalVisualViewport,
      });
    }
  });

  it("portals the floating panel into the modal portal container", () => {
    const overlay = document.createElement("div");
    const modalRoot = document.createElement("div");
    overlay.className = MODAL_OVERLAY_CLASS_NAME;
    modalRoot.setAttribute(MODAL_PORTAL_CONTAINER_ATTR, "");
    overlay.appendChild(modalRoot);
    document.body.appendChild(overlay);

    act(() => {
      root.render(
        <FloatingAgentChatFrame layer="modal" placement="bottom-end">
          <span>PXI content</span>
        </FloatingAgentChatFrame>
      );
    });

    const panel = modalRoot.querySelector(".resizable-floating-panel");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("data-layer")).toBe("modal");
  });
});
