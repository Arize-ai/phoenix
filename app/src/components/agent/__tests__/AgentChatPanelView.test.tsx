import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MODAL_OVERLAY_CLASS_NAME,
  MODAL_PORTAL_CONTAINER_ATTR,
} from "@phoenix/components/core/overlay/constants";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AgentChatHeader, FloatingAgentChatFrame } from "../AgentChatPanelView";

function expectButtonDisabled(button: Element | null) {
  expect(button).not.toBeNull();
  expect(
    button?.hasAttribute("disabled") ||
      button?.getAttribute("aria-disabled") === "true"
  ).toBe(true);
}

function renderWithProviders(children: ReactNode) {
  return (
    <ThemeProvider themeMode="light" disableBodyTheme>
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

describe("AgentChatHeader", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
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
    const onPreferredPositionChange = vi.fn();

    act(() => {
      root.render(
        renderWithProviders(
          <AgentChatHeader
            sessionDisplayName="PXI"
            orderedSessions={[]}
            activeSessionId={null}
            showSessionHistory={false}
            preferredPosition="pinned"
            onSelectSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onCreateSession={vi.fn()}
            onPreferredPositionChange={onPreferredPositionChange}
            onClose={vi.fn()}
          />
        )
      );
    });

    const toggleButton = container.querySelector(
      'button[aria-label="Switch assistant to floating panel"]'
    );

    expect(toggleButton).not.toBeNull();

    act(() => {
      toggleButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPreferredPositionChange).toHaveBeenCalledWith("detached");
  });

  it("switches from floating mode back to pinned", () => {
    const onPreferredPositionChange = vi.fn();

    act(() => {
      root.render(
        renderWithProviders(
          <AgentChatHeader
            sessionDisplayName="PXI"
            orderedSessions={[]}
            activeSessionId={null}
            showSessionHistory={false}
            preferredPosition="detached"
            onSelectSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onCreateSession={vi.fn()}
            onPreferredPositionChange={onPreferredPositionChange}
            onClose={vi.fn()}
          />
        )
      );
    });

    const toggleButton = container.querySelector(
      'button[aria-label="Pin assistant to side"]'
    );

    expect(toggleButton).not.toBeNull();

    act(() => {
      toggleButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPreferredPositionChange).toHaveBeenCalledWith("pinned");
  });

  it("keeps the pin-detach toggle visible but disabled while floating mode is forced", () => {
    act(() => {
      root.render(
        renderWithProviders(
          <AgentChatHeader
            sessionDisplayName="PXI"
            orderedSessions={[]}
            activeSessionId={null}
            showSessionHistory={false}
            preferredPosition="detached"
            onSelectSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onCreateSession={vi.fn()}
            onPreferredPositionChange={vi.fn()}
            isForcedFloatingMode
            onClose={vi.fn()}
          />
        )
      );
    });

    const toggleButton = container.querySelector(
      'button[aria-label="Pin assistant to side"]'
    );

    expectButtonDisabled(toggleButton);
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
