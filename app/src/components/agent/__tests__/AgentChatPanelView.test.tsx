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
