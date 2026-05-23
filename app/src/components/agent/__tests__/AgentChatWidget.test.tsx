import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
