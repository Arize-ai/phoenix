import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
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
  // eslint-disable-next-line react/globals
  agentStore = useAgentStore();
  return null;
}

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
                githubServerEnabled: false,
                githubEnabled: false,
                githubWorkspaceTokenConfigured: false,
                allowLocalTraces: true,
                allowRemoteExport: false,
                sessionRetentionMaxIdleDays: 30,
                sessionRetentionMaxCountPerUser: null,
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

  it("ignores Command+I when PXI is disabled", () => {
    renderWidget({ isAssistantAgentEnabled: false });

    dispatchCommandI();

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("false");
  });

  it("keeps the thinking treatment until the active response settles", () => {
    renderWidget();

    act(() => {
      agentStore?.getState().setActiveSession("session-node-id");
      agentStore?.getState().setSessionResponsePending("session-node-id", true);
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
});
