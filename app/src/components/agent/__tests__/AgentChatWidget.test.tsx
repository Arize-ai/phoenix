import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  MODAL_OVERLAY_CLASS_NAME,
  MODAL_PORTAL_CONTAINER_ATTR,
} from "@phoenix/components/core/overlay/constants";
import {
  AgentProvider,
  useAgentContext,
  useAgentStore,
} from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import type { AgentStore } from "@phoenix/store/agentStore";

import { AgentChatWidget } from "../AgentChatWidget";

installTestStorage();

let agentStore: AgentStore | null = null;

function AgentStoreCapture() {
  agentStore = useAgentStore();
  return null;
}

function AgentOpenState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  return <span data-testid="agent-open">{String(isOpen)}</span>;
}

function AgentWidgetWithBoundary() {
  const boundaryRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={boundaryRef}>
      <AgentChatWidget boundaryRef={boundaryRef} />
      <AgentOpenState />
    </div>
  );
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

function dispatchCommandIFromElement(target: Element) {
  act(() => {
    target.dispatchEvent(
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
    agentStore = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    agentStore = null;
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
          <PreferencesProvider
            isAssistantAgentEnabled={isAssistantAgentEnabled}
          >
            <AgentProvider
              agentsConfig={{
                collectorEndpoint: null,
                assistantProjectName: "assistant_agent",
                forceTracing: false,
                webAccessEnabled: false,
                assistantEnabled: true,
                allowLocalTraces: true,
                allowRemoteExport: false,
              }}
            >
              <AgentStoreCapture />
              <AgentChatWidget />
              <AgentOpenState />
            </AgentProvider>
          </PreferencesProvider>
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

  it("toggles PXI closed with Command+I while a form field is focused", () => {
    renderWidget();

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    dispatchCommandIFromElement(textarea);

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");

    // With the popover open, focus lives inside the chat's textarea. The
    // shortcut must still fire from a form field so it can toggle closed.
    dispatchCommandIFromElement(textarea);

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("false");

    textarea.remove();
  });

  it("hides the mounted FAB while PXI is open", () => {
    renderWidget();

    const positioner = document.body.querySelector(
      ".agent-chat-widget-positioner"
    );
    expect(positioner).not.toBeNull();
    expect(positioner?.getAttribute("data-hidden")).toBeNull();

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");
    expect(document.body.querySelector(".agent-chat-widget-positioner")).toBe(
      positioner
    );
    expect(positioner?.getAttribute("data-hidden")).toBe("true");

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("false");
    expect(document.body.querySelector(".agent-chat-widget-positioner")).toBe(
      positioner
    );
    expect(positioner?.getAttribute("data-hidden")).toBeNull();
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

  it("enables the one-shot hover wipe when the FAB appears", () => {
    renderWidget();

    expect(
      document.body.querySelector('[data-entrance-animation="true"]')
    ).not.toBeNull();
  });

  it("keeps the thinking treatment until the active response settles", () => {
    renderWidget();

    act(() => {
      const sessionId = agentStore?.getState().createSession();
      if (sessionId) {
        agentStore?.getState().setSessionResponsePending(sessionId, true);
      }
    });

    expect(
      document.body.querySelector(".agent-chat-widget__shimmer")
    ).not.toBeNull();

    act(() => {
      const sessionId = agentStore?.getState().activeSessionId;
      if (sessionId) {
        agentStore?.getState().setSessionChatStatus(sessionId, "ready");
      }
    });

    expect(
      document.body.querySelector(".agent-chat-widget__shimmer")
    ).not.toBeNull();

    act(() => {
      const sessionId = agentStore?.getState().activeSessionId;
      if (sessionId) {
        agentStore?.getState().setSessionResponsePending(sessionId, false);
      }
    });

    expect(
      document.body.querySelector(".agent-chat-widget__shimmer")
    ).toBeNull();
  });

  it("marks the FAB ready on first render when constrained to a boundary", async () => {
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
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

    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider isAssistantAgentEnabled>
            <AgentProvider
              agentsConfig={{
                collectorEndpoint: null,
                assistantProjectName: "assistant_agent",
                forceTracing: false,
                webAccessEnabled: false,
                assistantEnabled: true,
                allowLocalTraces: true,
                allowRemoteExport: false,
              }}
            >
              <AgentWidgetWithBoundary />
            </AgentProvider>
          </PreferencesProvider>
        </ThemeProvider>
      );
    });

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(getBoundingClientRect).toHaveBeenCalled();
    expect(
      document.body
        .querySelector(".agent-chat-widget-positioner")
        ?.getAttribute("data-ready")
    ).toBe("true");
  });
});
