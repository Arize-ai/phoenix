import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      .querySelectorAll(".react-aria-ModalOverlay")
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

  it("portals the floating panel into the modal overlay layer", () => {
    const overlay = document.createElement("div");
    const modalRoot = document.createElement("div");
    overlay.className = "react-aria-ModalOverlay";
    modalRoot.dataset.rac = "";
    modalRoot.dataset.size = "S";
    modalRoot.dataset.variant = "default";
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
