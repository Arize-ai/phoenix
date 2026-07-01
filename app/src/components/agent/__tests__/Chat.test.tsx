import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ChatView } from "../Chat";

type ChatViewSendMessage = Parameters<typeof ChatView>[0]["sendMessage"];

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

function renderChatView(
  root: Root,
  {
    autoFocusInput = false,
    chatKey = "chat",
    sendMessage = vi.fn<ChatViewSendMessage>(),
  }: {
    autoFocusInput?: boolean;
    chatKey?: string;
    sendMessage?: ChatViewSendMessage;
  } = {}
) {
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
            key={chatKey}
            sessionId="session-1"
            messages={[]}
            sendMessage={sendMessage}
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

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  act(() => {
    if (valueSetter) {
      valueSetter.call(textarea, value);
    } else {
      textarea.value = value;
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(textarea: HTMLTextAreaElement): void {
  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      })
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

  it("preserves the prompt draft when the chat view remounts", () => {
    renderChatView(root, { chatKey: "initial" });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );
    expect(textarea).not.toBeNull();

    setTextareaValue(textarea!, "preserve this draft");

    renderChatView(root, { chatKey: "remounted" });

    const remountedTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );
    expect(remountedTextarea).not.toBeNull();
    expect(remountedTextarea?.value).toBe("preserve this draft");
  });

  it("clears the prompt draft after submit", () => {
    const sendMessage = vi.fn<ChatViewSendMessage>();
    renderChatView(root, { sendMessage });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );
    expect(textarea).not.toBeNull();

    setTextareaValue(textarea!, "send this draft");
    pressEnter(textarea!);

    expect(sendMessage).toHaveBeenCalledWith(
      { text: "send this draft" },
      undefined
    );
    expect(textarea?.value).toBe("");
  });
});
