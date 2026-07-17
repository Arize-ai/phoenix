import type { Chat } from "@ai-sdk/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { createAgentChatRuntimeRegistry } from "@phoenix/contexts/AgentChatRuntimeContext";

import {
  applyCanonicalRewind,
  syncCommittedAgentSession,
} from "../useAgentChat";

function createChat(messages: AgentUIMessage[] = []): Chat<AgentUIMessage> {
  return {
    messages,
    status: "ready",
    "~registerStatusCallback": () => vi.fn(),
    "~registerMessagesCallback": () => vi.fn(),
  } as unknown as Chat<AgentUIMessage>;
}

function createStreamingChat(messages: AgentUIMessage[] = []) {
  const statusListeners = new Set<() => void>();
  const chat = {
    messages,
    status: "streaming",
    "~registerStatusCallback": (listener: () => void) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    "~registerMessagesCallback": () => vi.fn(),
  } as unknown as Chat<AgentUIMessage>;
  return {
    chat,
    setStatus: (status: Chat<AgentUIMessage>["status"]) => {
      Object.assign(chat, { status });
      statusListeners.forEach((listener) => listener());
    },
  };
}

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("committed agent session reconciliation", () => {
  it("refreshes Relay before evicting the live overlay", async () => {
    const runtime = createAgentChatRuntimeRegistry();
    const chat = createChat();
    runtime.getOrCreateChat({
      sessionId: "session",
      chatApiUrl: "/chat",
      createChat: () => chat,
    });
    const refresh = createDeferred();

    const reconciliation = syncCommittedAgentSession({
      runtime,
      sessionId: "session",
      chat,
      refreshSession: () => refresh.promise,
    });

    expect(runtime.getChat("session")).toBe(chat);
    refresh.resolve();
    await expect(reconciliation).resolves.toBe(true);
    expect(runtime.getChat("session")).toBeNull();
  });

  it("evicts the exact live overlay after a committed stream becomes ready", async () => {
    const runtime = createAgentChatRuntimeRegistry();
    const { chat, setStatus } = createStreamingChat();
    runtime.getOrCreateChat({
      sessionId: "session",
      chatApiUrl: "/chat",
      createChat: () => chat,
    });
    const refreshSession = vi.fn(async () => undefined);

    const reconciliation = syncCommittedAgentSession({
      runtime,
      sessionId: "session",
      chat,
      refreshSession,
    });

    await vi.waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
    expect(runtime.getChat("session")).toBe(chat);
    setStatus("ready");

    await expect(reconciliation).resolves.toBe(true);
    expect(runtime.getChat("session")).toBeNull();
  });

  it("keeps unresolved client tools live after the Relay refresh", async () => {
    const runtime = createAgentChatRuntimeRegistry();
    const chat = createChat([
      {
        id: "assistant-message",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "ask_user",
            toolCallId: "tool-call",
            state: "input-available",
            input: {},
          },
        ],
      } as AgentUIMessage,
    ]);
    runtime.getOrCreateChat({
      sessionId: "session",
      chatApiUrl: "/chat",
      createChat: () => chat,
    });
    const refreshSession = vi.fn(async () => undefined);

    await expect(
      syncCommittedAgentSession({
        runtime,
        sessionId: "session",
        chat,
        refreshSession,
      })
    ).resolves.toBe(false);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(runtime.getChat("session")).toBe(chat);
  });

  it("retains the transcript and exposes a sync error when refresh fails", async () => {
    const runtime = createAgentChatRuntimeRegistry();
    const chat = createChat([
      { id: "live-message", role: "assistant", parts: [] },
    ]);
    runtime.getOrCreateChat({
      sessionId: "background-session",
      chatApiUrl: "/chat",
      createChat: () => chat,
    });
    const refreshError = new Error("Relay network failed");

    await expect(
      syncCommittedAgentSession({
        runtime,
        sessionId: "background-session",
        chat,
        refreshSession: async () => Promise.reject(refreshError),
      })
    ).resolves.toBe(false);

    expect(runtime.getChat("background-session")?.messages).toEqual(
      chat.messages
    );
    expect(runtime.getSyncError("background-session")).toBe(refreshError);
  });
});

describe("canonical rewind reconciliation", () => {
  it("uses the mutation transcript instead of the local rewind projection", () => {
    const localProjection: AgentUIMessage[] = [
      { id: "local-message", role: "user", parts: [] },
    ];
    const canonicalMessages: AgentUIMessage[] = [
      { id: "canonical-message", role: "assistant", parts: [] },
    ];
    const chat = createChat(localProjection);
    chat.clearError = vi.fn();
    const clearDroppedToolState = vi.fn();

    const appliedMessages = applyCanonicalRewind({
      chat,
      previousMessages: localProjection,
      responseMessages: canonicalMessages,
      clearDroppedToolState,
    });

    expect(appliedMessages).toBe(canonicalMessages);
    expect(chat.messages).toBe(canonicalMessages);
    expect(clearDroppedToolState).toHaveBeenCalledWith({
      previous: localProjection,
      next: canonicalMessages,
    });
  });
});
