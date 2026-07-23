import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ChatView } from "../Chat";

type ChatViewSendMessage = Parameters<typeof ChatView>[0]["sendMessage"];
type ChatViewCompactSession = Parameters<typeof ChatView>[0]["compactSession"];

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
  AssistantMessage: ({ message }: { message: AgentUIMessage }) => (
    <div data-message-id={message.id} />
  ),
  UserMessage: ({ message }: { message: AgentUIMessage }) => (
    <div data-message-id={message.id} />
  ),
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
    isDraftSessionTemporary,
    sendMessage = vi.fn<ChatViewSendMessage>(),
    compactSession = vi.fn<ChatViewCompactSession>(),
    isCompacting = false,
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
    isDraftSessionTemporary?: boolean;
    sendMessage?: ChatViewSendMessage;
    compactSession?: ChatViewCompactSession;
    isCompacting?: boolean;
    rewindToMessage?: (messageId: string) => Promise<string | null>;
    forkFromMessage?: (messageId: string) => void;
  } = {}
) {
  act(() => {
    root.render(
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
            sessionRetentionMaxIdleDays: 30,
            sessionRetentionMaxCountPerUser: null,
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
            "graphql.mutations": false,
            "subagents.enabled": false,
            "web.access": false,
          }}
          {...(initialDraftInputBySessionId
            ? { draftInputBySessionId: initialDraftInputBySessionId }
            : {})}
          {...(isDraftSessionTemporary != null
            ? { isDraftSessionTemporary }
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
            compactSession={compactSession}
            isCompacting={isCompacting}
            rewindToMessage={rewindToMessage}
            forkFromMessage={forkFromMessage}
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
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
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

  it("runs /compact without sending it as a user message", async () => {
    const sendMessage = vi.fn<ChatViewSendMessage>();
    const compactSession = vi.fn<ChatViewCompactSession>();
    renderChatView(root, { sendMessage, compactSession });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );
    expect(textarea).not.toBeNull();

    setTextareaValue(textarea!, "/compact");
    pressEnter(textarea!);
    await act(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );

    expect(compactSession).toHaveBeenCalledWith(undefined);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("passes text after /compact without sending the command token", () => {
    const sendMessage = vi.fn<ChatViewSendMessage>();
    const compactSession = vi.fn<ChatViewCompactSession>();
    renderChatView(root, { sendMessage, compactSession });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );
    setTextareaValue(textarea!, "/compact continue investigating");
    pressEnter(textarea!);

    expect(compactSession).toHaveBeenCalledWith({
      text: "continue investigating",
      requestedSkills: [],
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not submit another message while compaction is in progress", () => {
    const sendMessage = vi.fn<ChatViewSendMessage>();
    renderChatView(root, { sendMessage, isCompacting: true });

    const textarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message input"]'
    );

    expect(textarea?.disabled).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Compacting conversation…"
    );
  });

  it("renders a divider after the compacted transcript boundary", () => {
    const nextUserMessage = {
      id: "user-message-2",
      role: "user",
      parts: [{ type: "text", text: "Continue" }],
    } as AgentUIMessage;
    const compactionMessage = {
      id: "compaction-message",
      role: "user",
      metadata: {
        type: "user",
        currentDateTime: "2026-01-01T00:00:00Z",
        timeZone: "UTC",
        isCompactionMessage: true,
      },
      parts: [
        {
          type: "text",
          text: `The following summarizes the conversation with the user so far. Use it as historical context, not as a new user request. Use the latest state described below when responding to subsequent user messages.

<objectives>
- Investigate the trace
</objectives>
<completed_work>
- Located the slow span
</completed_work>
<next_steps>
- Inspect the latest turn
</next_steps>
<important_details>
- trace-id-123
</important_details>`,
        },
      ],
    } as AgentUIMessage;
    renderChatView(root, {
      chatMessages: [...messages, compactionMessage, nextUserMessage],
    });

    const divider = container.querySelector<HTMLElement>(
      '[role="separator"][aria-label="Conversation context compacted"]'
    );
    expect(divider?.textContent).toBe("Context compacted");
    expect(
      divider?.previousElementSibling?.getAttribute("data-message-id")
    ).toBe("assistant-message");
    const summary = divider?.nextElementSibling;
    expect(summary?.getAttribute("aria-label")).toBe("Compaction summary");
    expect(summary?.textContent).toContain("Objectives");
    expect(summary?.textContent).toContain("Investigate the trace");
    expect(summary?.textContent).toContain("trace-id-123");
    expect(summary?.textContent).not.toContain("Blockers");
    expect(summary?.textContent).not.toContain("historical context");
    expect(summary?.nextElementSibling?.getAttribute("data-message-id")).toBe(
      "user-message-2"
    );
  });

  it("renders every durable compaction message in the transcript", () => {
    const compactionMessages = ["first summary", "second summary"].map(
      (summary, index) =>
        ({
          id: `compaction-${index}`,
          role: "user",
          metadata: {
            type: "user",
            currentDateTime: "2026-01-01T00:00:00Z",
            timeZone: "UTC",
            isCompactionMessage: true,
          },
          parts: [{ type: "text", text: summary }],
        }) as AgentUIMessage
    );

    renderChatView(root, {
      chatMessages: [
        messages[0]!,
        compactionMessages[0]!,
        messages[1]!,
        compactionMessages[1]!,
      ],
    });

    const summaries = container.querySelectorAll(
      '[aria-label="Compaction summary"]'
    );
    expect(summaries).toHaveLength(2);
    expect(summaries[0]?.textContent).toContain("first summary");
    expect(summaries[1]?.textContent).toContain("second summary");
  });

  it("truncates and resends the last user message when retrying a failed turn", async () => {
    const sendMessage = vi.fn<ChatViewSendMessage>();
    const rewindToMessage = vi.fn().mockResolvedValue("What happened?");
    renderChatView(root, {
      chatMessages: messages,
      error: new Error("provider unavailable"),
      status: "error",
      sendMessage,
      rewindToMessage,
      forkFromMessage: vi.fn(),
    });

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry"
    );
    expect(retryButton).not.toBeUndefined();

    await act(async () => {
      retryButton?.click();
    });

    expect(rewindToMessage).toHaveBeenCalledWith("user-message");
    expect(sendMessage).toHaveBeenCalledWith({ text: "What happened?" });
    expect(container.textContent).toContain("Show technical details");
    expect(container.textContent).toContain("provider unavailable");
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

  it("retries an interrupted user message without duplicating it", async () => {
    const sendMessage = vi.fn();
    const rewindToMessage = vi.fn(async () => "What happened?");
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

    await act(async () => {
      retryButton?.click();
    });

    expect(rewindToMessage).toHaveBeenCalledWith("user-message");
    expect(sendMessage).toHaveBeenCalledWith({ text: "What happened?" });
  });

  it("confirms editing an interrupted user message", () => {
    const rewindToMessage = vi.fn(async () => "What happened?");
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
    const rewindToMessage = vi.fn(async () => "What happened?");
    renderChatView(root, {
      chatMessages: messages,
      error: new Error("provider unavailable"),
      status: "error",
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
