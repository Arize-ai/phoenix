import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MODAL_OVERLAY_CLASS_NAME,
  MODAL_PORTAL_CONTAINER_ATTR,
} from "@phoenix/components/core/overlay/constants";
import { AgentProvider, useAgentContext } from "@phoenix/contexts/AgentContext";
import { FeatureFlagsContext } from "@phoenix/contexts/FeatureFlagsContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AgentChatWidget } from "../AgentChatWidget";

function AgentOpenState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  return <span data-testid="agent-open">{String(isOpen)}</span>;
}

function dispatchCommandI() {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyI",
        key: "i",
        metaKey: true,
      })
    );
  });
}

function appendModalOverlay() {
  const overlay = document.createElement("div");
  const modalRoot = document.createElement("div");
  overlay.className = MODAL_OVERLAY_CLASS_NAME;
  modalRoot.setAttribute(MODAL_PORTAL_CONTAINER_ATTR, "");
  overlay.appendChild(modalRoot);
  document.body.appendChild(overlay);
  return overlay;
}

function dispatchPointerEvent(
  element: Element,
  type: string,
  init: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    pointerType?: string;
  }
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
  Object.defineProperty(event, "pointerType", {
    value: init.pointerType ?? "mouse",
  });
  element.dispatchEvent(event);
}

describe("AgentChatWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
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
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderWidget({
    isAssistantAgentEnabled = true,
  }: {
    isAssistantAgentEnabled?: boolean;
  } = {}) {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <FeatureFlagsContext.Provider
            value={{
              featureFlags: { agents: true, tracing_ux: false },
              setFeatureFlags: vi.fn(),
            }}
          >
            <PreferencesProvider
              isAssistantAgentEnabled={isAssistantAgentEnabled}
            >
              <AgentProvider>
                <AgentChatWidget />
                <AgentOpenState />
              </AgentProvider>
            </PreferencesProvider>
          </FeatureFlagsContext.Provider>
        </ThemeProvider>
      );
    });
  }

  it("toggles PXI with Command+I", () => {
    renderWidget();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("false");

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("false");
  });

  it("toggles PXI with Command+I while a modal overlay is open", () => {
    appendModalOverlay();
    renderWidget();

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");
  });

  it("ignores Command+I when PXI is disabled", () => {
    renderWidget({ isAssistantAgentEnabled: false });

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("false");
  });

  it("toggles PXI when the FAB is clicked", () => {
    renderWidget();

    const fabButton = document.body.querySelector(
      'button[aria-label="Open assistant"]'
    );
    const positioner = document.body.querySelector(
      ".agent-chat-widget-positioner"
    );
    expect(fabButton).not.toBeNull();
    expect(positioner).not.toBeNull();
    Object.assign(positioner!, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
    });

    act(() => {
      dispatchPointerEvent(fabButton!, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(fabButton!, "pointerup", {
        clientX: 935,
        clientY: 758,
      });
    });

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");
  });

  it("keeps the FAB available in the modal portal container", () => {
    const overlay = appendModalOverlay();
    const modalRoot = overlay.firstElementChild;
    renderWidget();

    const positioner = document.body.querySelector(
      ".agent-chat-widget-positioner"
    );

    expect(positioner).not.toBeNull();
    expect(positioner?.getAttribute("data-layer")).toBe("modal");
    expect(modalRoot?.contains(positioner)).toBe(true);
  });

  it("moves the modal-layer FAB when a newer modal becomes active", async () => {
    const firstOverlay = appendModalOverlay();
    const firstModalRoot = firstOverlay.firstElementChild;
    renderWidget();

    const positioner = document.body.querySelector(
      ".agent-chat-widget-positioner"
    );
    expect(positioner).not.toBeNull();
    expect(firstModalRoot?.contains(positioner)).toBe(true);

    const secondOverlay = document.createElement("div");
    const secondModalRoot = document.createElement("div");
    secondOverlay.className = MODAL_OVERLAY_CLASS_NAME;
    secondModalRoot.setAttribute(MODAL_PORTAL_CONTAINER_ATTR, "");
    secondOverlay.appendChild(secondModalRoot);
    await act(async () => {
      document.body.appendChild(secondOverlay);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const movedPositioner = document.body.querySelector(
      ".agent-chat-widget-positioner"
    );
    expect(secondModalRoot.contains(movedPositioner)).toBe(true);
  });

  it("toggles PXI when the modal-layer FAB is clicked", () => {
    appendModalOverlay();
    renderWidget();

    const fabButton = document.body.querySelector(
      'button[aria-label="Open assistant"]'
    );
    const positioner = document.body.querySelector(
      ".agent-chat-widget-positioner"
    );
    expect(fabButton).not.toBeNull();
    expect(positioner).not.toBeNull();
    Object.assign(positioner!, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
    });

    act(() => {
      dispatchPointerEvent(fabButton!, "pointerdown", {
        clientX: 935,
        clientY: 758,
      });
      dispatchPointerEvent(fabButton!, "pointerup", {
        clientX: 935,
        clientY: 758,
      });
    });

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");
  });

  it("shows the shortcut tooltip when the FAB is hovered", () => {
    vi.useFakeTimers();
    renderWidget();

    const fabButton = document.body.querySelector(
      'button[aria-label="Open assistant"]'
    ) as HTMLButtonElement | null;
    expect(fabButton).not.toBeNull();

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 935,
          clientY: 758,
        })
      );
      dispatchPointerEvent(fabButton!, "pointerover", {
        clientX: 935,
        clientY: 758,
        pointerType: "mouse",
      });
      fabButton?.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
          clientX: 935,
          clientY: 758,
        })
      );
      vi.advanceTimersByTime(1000);
    });

    expect(document.body.textContent).toContain("Open assistant");
  });
});
