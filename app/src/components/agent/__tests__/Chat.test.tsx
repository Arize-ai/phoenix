import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
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

vi.mock("../useAvailableAgentSkills", () => ({
  useAvailableAgentSkills: () => [],
}));

vi.mock("../ChatMessage", () => ({
  AssistantMessage: () => null,
  UserMessage: () => null,
}));

const messages = [
  {
    id: "user-message",
    role: "user",
    parts: [{ type: "text", text: "What happened?" }],
  },
  {
    id: "assistant-message",
    role: "assistant",
    parts: [{ type: "text", text: "I started checking." }],
  },
] as AgentUIMessage[];

const unansweredUserMessages = [messages[0]!] as AgentUIMessage[];

function renderChatView(
  root: Root,
  {
    sessionId = "session-1",
    autoFocusInput = false,
    chatKey,
    chatMessages = [],
    error,
    status = "ready",
    initialDraftInputBySessionId,
    sendMessage = vi.fn<ChatViewSendMessage>(),
    retryMessage,
    rewindToMessage,
    forkFromMessage,
  }: {
    sessionId?: string;
    autoFocusInput?: boolean;
    chatKey?: string;
    chatMessages?: AgentUIMessage[];
    error?: Error;
    status?: "ready" | "error";
    initialDraftInputBySessionId?: Record<string, string>;
    sendMessage?: ChatViewSendMessage;
    retryMessage?: (messageId?: string) => void;
    rewindToMessage?: (messageId: string) => string | null;
    forkFromMessage?: (messageId: string) => string | null;
  } = {}
) {
  act(() => {
    root.render(
      <MemoryRouter>
        <ThemeProvider themeMode="light" disableBodyTheme>
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
            observability={{
              storeLocalTraces: true,
              exportRemoteTraces: false,
              attachUserId: false,
              acknowledgedTraceConsent: {
                allowLocalTraces: true,
                allowRemoteExport: false,
              },
            }}
            capabilities={{
              "bash.retainInactiveSessions": false,
              "graphql.mutations": false,
              "session.storeSessions": true,
              "subagents.enabled": false,
              "web.access": false,
            }}
            {...(initialDraftInputBySessionId
              ? { draftInputBySessionId: initialDraftInputBySessionId }
              : {})}
          >
            <ChatView
              key={chatKey ?? sessionId ?? "no-session"}
              sessionId={sessionId}
              messages={chatMessages}
              sendMessage={sendMessage}
              stop={async () => undefined}
              status={status}
              error={error}
              pendingElicitation={null}
              handleElicitationSubmit={vi.fn()}
              handleElicitationCancel={vi.fn()}
              retryMessage={retryMessage}
              rewindToMessage={rewindToMessage}
              forkFromMessage={forkFromMessage}
              modelMenuValue={{ provider: "ANTHROPIC", modelName: "claude" }}
              onModelChange={vi.fn()}
              autoFocusInput={autoFocusInput}
            />
          </AgentProvider>
        </ThemeProvider>
      </MemoryRouter>
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

  it("restores draft input when switching to a keyed session", () => {
    renderChatView(root, {
      sessionId: "session-1",
      initialDraftInputBySessionId: { "fork-session": "edit me" },
    });
    renderChatView(root, { sessionId: "fork-session" });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );

    expect(textarea?.value).toBe("edit me");
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

  it("shows retry and technical details for failed turns", () => {
    const retryMessage = vi.fn();
    renderChatView(root, {
      chatMessages: messages,
      error: new Error("provider unavailable"),
      status: "error",
      retryMessage,
      rewindToMessage: vi.fn(),
      forkFromMessage: vi.fn(),
    });

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry"
    );
    expect(retryButton).not.toBeUndefined();

    act(() => {
      retryButton?.click();
    });

    expect(retryMessage).toHaveBeenCalledWith("assistant-message");
    expect(container.textContent).toContain("Show technical details");
    expect(container.textContent).toContain("provider unavailable");
  });

  it("surfaces API key errors with remediation guidance and a settings link", () => {
    renderChatView(root, {
      chatMessages: messages,
      error: new Error(
        "The model provider rejected the request because the API key is " +
          "missing, invalid, or misconfigured. Add a valid API key for the " +
          "selected model in Settings, then try again.\n\n" +
          "Provider error: 401 Unauthorized"
      ),
      status: "error",
      retryMessage: vi.fn(),
      rewindToMessage: vi.fn(),
      forkFromMessage: vi.fn(),
    });

    expect(container.textContent).toContain(
      "The model provider rejected your API key."
    );
    expect(container.textContent).toContain("AI provider settings");
    const settingsLink = Array.from(container.querySelectorAll("a")).find(
      (anchor) => anchor.getAttribute("href") === "/settings/providers"
    );
    expect(settingsLink).not.toBeUndefined();
    // technical detail from the provider is still available
    expect(container.textContent).toContain("Provider error: 401 Unauthorized");
  });

  it("shows interrupted recovery when history ends on a user message", () => {
    renderChatView(root, {
      chatMessages: unansweredUserMessages,
      status: "ready",
      rewindToMessage: vi.fn(),
      forkFromMessage: vi.fn(),
    });

    expect(container.textContent).toContain("PXI did not respond.");
    expect(container.textContent).toContain(
      "This message was interrupted before PXI could respond."
    );
    expect(container.textContent).toContain("Retry");
    expect(container.textContent).toContain("Edit message");
    expect(container.textContent).toContain("Branch before message");
  });

  it("retries an interrupted user message without duplicating it", () => {
    const sendMessage = vi.fn();
    const rewindToMessage = vi.fn(() => "What happened?");
    renderChatView(root, {
      chatMessages: unansweredUserMessages,
      status: "ready",
      sendMessage,
      rewindToMessage,
      forkFromMessage: vi.fn(),
    });

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry"
    );
    expect(retryButton).not.toBeUndefined();

    act(() => {
      retryButton?.click();
    });

    expect(rewindToMessage).toHaveBeenCalledWith("user-message");
    expect(sendMessage).toHaveBeenCalledWith({ text: "What happened?" });
  });

  it("confirms editing an interrupted user message", () => {
    const rewindToMessage = vi.fn(() => "What happened?");
    renderChatView(root, {
      chatMessages: unansweredUserMessages,
      status: "ready",
      rewindToMessage,
      forkFromMessage: vi.fn(),
    });

    const editButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Edit message"
    );
    expect(editButton).not.toBeUndefined();

    act(() => {
      editButton?.click();
    });

    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Rewind conversation"
    );
    act(() => {
      confirmButton?.click();
    });

    expect(rewindToMessage).toHaveBeenCalledWith("user-message");
  });

  it("confirms branching before an interrupted user message", () => {
    const forkFromMessage = vi.fn(() => "branch-session");
    renderChatView(root, {
      chatMessages: unansweredUserMessages,
      status: "ready",
      rewindToMessage: vi.fn(),
      forkFromMessage,
    });

    const branchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Branch before message"
    );
    expect(branchButton).not.toBeUndefined();

    act(() => {
      branchButton?.click();
    });

    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Branch conversation"
    );
    act(() => {
      confirmButton?.click();
    });

    expect(forkFromMessage).toHaveBeenCalledWith("user-message");
  });

  it("confirms undoing a failed turn from the latest user message", () => {
    const rewindToMessage = vi.fn(() => "What happened?");
    renderChatView(root, {
      chatMessages: messages,
      error: new Error("provider unavailable"),
      status: "error",
      retryMessage: vi.fn(),
      rewindToMessage,
      forkFromMessage: vi.fn(),
    });

    const undoButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Undo failed turn"
    );
    expect(undoButton).not.toBeUndefined();

    act(() => {
      undoButton?.click();
    });

    expect(container.textContent).toContain("Rewind conversation");

    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Rewind conversation"
    );
    act(() => {
      confirmButton?.click();
    });

    expect(rewindToMessage).toHaveBeenCalledWith("user-message");
  });

  it("confirms branching before a failed turn from the latest user message", () => {
    const forkFromMessage = vi.fn(() => "forked-session");
    renderChatView(root, {
      chatMessages: messages,
      error: new Error("provider unavailable"),
      status: "error",
      retryMessage: vi.fn(),
      rewindToMessage: vi.fn(),
      forkFromMessage,
    });

    const forkButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Branch before error"
    );
    expect(forkButton).not.toBeUndefined();

    act(() => {
      forkButton?.click();
    });

    expect(container.textContent).toContain("Branch conversation");

    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Branch conversation"
    );
    act(() => {
      confirmButton?.click();
    });

    expect(forkFromMessage).toHaveBeenCalledWith("user-message");
  });
});
