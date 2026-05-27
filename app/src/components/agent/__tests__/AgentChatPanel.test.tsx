import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { FeatureFlagsContext } from "@phoenix/contexts/FeatureFlagsContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { FloatingAgentChatPanel } from "../AgentChatPanel";

const useAgentChatPanelStateMock = vi.hoisted(() => vi.fn());
const useAgentChatMock = vi.hoisted(() => vi.fn());

vi.mock("../useAgentChatPanelState", () => ({
  useAgentChatPanelState: () => useAgentChatPanelStateMock(),
}));

vi.mock("../useAgentChat", () => ({
  useAgentChat: () => useAgentChatMock(),
}));

vi.mock("../Chat", () => ({
  ChatView: ({ children }: { children?: ReactNode }) => (
    <div data-testid="chat-view">{children}</div>
  ),
}));

function mockPanelState(overrides: Record<string, unknown> = {}) {
  useAgentChatPanelStateMock.mockReturnValue({
    isOpen: true,
    position: "pinned",
    activeSessionId: null,
    orderedSessions: [],
    showSessionHistory: false,
    chatApiUrl: "/api/agent",
    modelSelection: {
      providerType: "custom",
      providerId: "test-provider",
      modelName: "test-model",
    },
    menuValue: null,
    createSession: vi.fn(),
    setActiveSession: vi.fn(),
    deleteSession: vi.fn(),
    closePanel: vi.fn(),
    setPosition: vi.fn(),
    handleModelChange: vi.fn(),
    ...overrides,
  });
}

describe("FloatingAgentChatPanel", () => {
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

    mockPanelState();
    useAgentChatMock.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      stop: vi.fn(),
      status: "ready",
      error: null,
      pendingElicitation: null,
      handleElicitationSubmit: vi.fn(),
      handleElicitationCancel: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  function renderPanel(isForcedFloatingMode?: boolean) {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <FeatureFlagsContext.Provider
            value={{
              featureFlags: { agents: true, tracing_ux: false },
              setFeatureFlags: vi.fn(),
            }}
          >
            <MemoryRouter>
              <AgentProvider>
                <FloatingAgentChatPanel
                  isForcedFloatingMode={isForcedFloatingMode}
                />
              </AgentProvider>
            </MemoryRouter>
          </FeatureFlagsContext.Provider>
        </ThemeProvider>
      );
    });
  }

  it("shows a floating close action when detached is the preferred position", () => {
    mockPanelState({ position: "detached" });

    renderPanel(false);

    expect(
      container.querySelector(".resizable-floating-panel__floating-action")
    ).not.toBeNull();
  });

  it("shows a floating close action while floating mode is forced", () => {
    mockPanelState({ position: "pinned" });

    renderPanel(true);

    expect(
      container.querySelector(".resizable-floating-panel__floating-action")
    ).not.toBeNull();
  });
});