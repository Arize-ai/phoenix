import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ChatView } from "../Chat";

vi.mock("@phoenix/agent/quickActions/quickActions", () => ({
  useAgentQuickActions: () => [],
}));

vi.mock("../AgentContextPills", () => ({
  AgentContextPills: () => null,
}));

vi.mock("../AgentEditPermissionMenu", () => ({
  AgentEditPermissionMenu: () => null,
  getNextEditPermissionMode: () => "bypass",
}));

vi.mock("../AgentModelCredentialForm", () => ({
  AgentModelCredentialForm: () => null,
  useAgentModelCredentialStatus: () => ({
    missingCredentialsProvider: null,
    refreshCredentialStatus: () => undefined,
  }),
}));

vi.mock("../AgentModelMenu", () => ({
  AgentModelMenu: () => <button type="button">Model</button>,
}));

vi.mock("../AgentWebSearchToggle", () => ({
  AgentWebSearchToggle: () => <button type="button">Web</button>,
}));

vi.mock("../ChatEmptyState", () => ({
  ChatEmptyState: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../ChatLantern", () => ({
  ChatLantern: () => null,
}));

vi.mock("../ChatMessage", () => ({
  AssistantMessage: () => null,
  UserMessage: () => null,
}));

function renderChatView(root: Root, { autoFocusInput = false } = {}) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AgentProvider
          agentsConfig={{
            collectorEndpoint: null,
            assistantProjectName: "assistant_agent",
            webAccessEnabled: false,
            assistantEnabled: true,
            allowLocalTraces: true,
            allowRemoteExport: false,
          }}
          observability={{
            storeLocalTraces: true,
            exportRemoteTraces: false,
            attachUserId: false,
            acknowledgedTraceConsent: {
              allowLocalTraces: true,
              allowRemoteExport: false,
            },
          }}
        >
          <ChatView
            sessionId="session-1"
            messages={[]}
            sendMessage={vi.fn()}
            stop={async () => undefined}
            status="ready"
            error={undefined}
            pendingElicitation={null}
            handleElicitationSubmit={vi.fn()}
            handleElicitationCancel={vi.fn()}
            modelMenuValue={{ provider: "ANTHROPIC", modelName: "claude" }}
            onModelChange={vi.fn()}
            autoFocusInput={autoFocusInput}
          />
        </AgentProvider>
      </ThemeProvider>
    );
  });
}

describe("ChatView", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("focuses the prompt textarea when requested", () => {
    renderChatView(root, { autoFocusInput: true });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );

    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
  });

  it("does not focus the prompt textarea by default", () => {
    renderChatView(root);

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );

    expect(textarea).not.toBeNull();
    expect(document.activeElement).not.toBe(textarea);
  });
});
