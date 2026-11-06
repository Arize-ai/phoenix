import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { AgentChatRuntimeProvider } from "@phoenix/contexts/AgentChatRuntimeContext";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { FloatingAgentChatPanel } from "../AgentChatPanel";

installTestStorage();

vi.mock("../Chat", () => ({
  ChatView: () => <div>Chat view</div>,
}));

vi.mock("../ChatSessionUsage", () => ({
  ChatSessionUsage: () => null,
}));

vi.mock("../useAgentChat", () => ({
  useAgentChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    stop: vi.fn(),
    status: "ready",
    error: null,
    pendingElicitation: null,
    handleElicitationSubmit: vi.fn(),
    handleElicitationCancel: vi.fn(),
    retryMessage: vi.fn(),
    rewindToMessage: vi.fn(),
    forkFromMessage: vi.fn(),
  }),
}));

vi.mock("../useAssistantAgentEnabled", () => ({
  useAssistantAgentEnabled: () => true,
}));

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

/**
 * Relay environment whose network resolves every operation with an empty
 * session list, so the panel renders its header without a live server.
 */
function createEmptySessionsEnvironment() {
  return new Environment({
    network: Network.create(() =>
      Promise.resolve({
        data: {
          agentSessions: {
            edges: [],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      })
    ),
    store: new Store(new RecordSource()),
  });
}

describe("FloatingAgentChatPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1000,
    });
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
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps its dragged position when a new chat is created", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <RelayEnvironmentProvider
            environment={createEmptySessionsEnvironment()}
          >
            <ThemeProvider themeMode="light" disableBodyTheme>
              <AgentProvider isOpen position="detached">
                <AgentChatRuntimeProvider>
                  <FloatingAgentChatPanel />
                </AgentChatRuntimeProvider>
              </AgentProvider>
            </ThemeProvider>
          </RelayEnvironmentProvider>
        </MemoryRouter>
      );
    });

    const panel = container.querySelector<HTMLDivElement>(
      ".resizable-floating-panel"
    );
    const header = container.querySelector<HTMLDivElement>(
      ".agent-chat-panel__header"
    );
    expect(panel).not.toBeNull();
    expect(header).not.toBeNull();
    if (!panel || !header) {
      throw new Error("Floating assistant panel did not render");
    }
    Object.assign(panel, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    act(() => {
      dispatchPointerEvent(header, "pointerdown", {
        clientX: 800,
        clientY: 300,
      });
      dispatchPointerEvent(panel, "pointermove", {
        clientX: 500,
        clientY: 270,
      });
      dispatchPointerEvent(panel, "pointerup", {
        clientX: 500,
        clientY: 270,
      });
    });

    const movedX = panel.style.getPropertyValue("--resizable-floating-panel-x");
    const movedY = panel.style.getPropertyValue("--resizable-floating-panel-y");
    expect(movedX).toBe("356px");
    expect(movedY).toBe("226px");

    const newChatButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="New chat"]'
    );
    expect(newChatButton).not.toBeNull();
    if (!newChatButton) {
      throw new Error("New chat button did not render");
    }
    act(() => {
      newChatButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const panelAfterNewChat = container.querySelector<HTMLDivElement>(
      ".resizable-floating-panel"
    );
    expect(panelAfterNewChat).toBe(panel);
    if (!panelAfterNewChat) {
      throw new Error("Floating assistant panel disappeared");
    }
    expect(
      panelAfterNewChat.style.getPropertyValue("--resizable-floating-panel-x")
    ).toBe(movedX);
    expect(
      panelAfterNewChat.style.getPropertyValue("--resizable-floating-panel-y")
    ).toBe(movedY);

    act(() => {
      newChatButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(
      container.querySelector<HTMLDivElement>(".resizable-floating-panel")
    ).toBe(panel);
  });
});
