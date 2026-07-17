import type { Chat } from "@ai-sdk/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import { createAgentChatRuntimeRegistry } from "../AgentChatRuntimeContext";

function createFakeChat({
  messages = [],
}: {
  messages?: AgentUIMessage[];
} = {}): Chat<AgentUIMessage> {
  return {
    messages,
    status: "ready",
    "~registerStatusCallback": () => vi.fn(),
    "~registerMessagesCallback": () => vi.fn(),
  } as unknown as Chat<AgentUIMessage>;
}

describe("agent chat runtime registry", () => {
  it("does not create an idle runtime and seeds the first live overlay", () => {
    const baseTranscript: AgentUIMessage[] = [
      { id: "canonical-message", role: "user", parts: [] },
    ];
    const chat = createFakeChat({ messages: baseTranscript });
    const createChat = vi.fn(() => chat);
    const runtime = createAgentChatRuntimeRegistry();

    expect(runtime.getChat("canonical-session")).toBeNull();
    expect(createChat).not.toHaveBeenCalled();

    const created = runtime.getOrCreateChat({
      sessionId: "canonical-session",
      chatApiUrl: "/chat",
      createChat,
    });

    expect(created).toBe(chat);
    expect(created.messages).toBe(baseTranscript);
    expect(runtime.getChat("canonical-session")).toBe(chat);
    expect(createChat).toHaveBeenCalledTimes(1);
  });

  it("retains a background runtime until explicit commit eviction", () => {
    const runtime = createAgentChatRuntimeRegistry();
    const chat = createFakeChat();
    runtime.getOrCreateChat({
      sessionId: "background-session",
      chatApiUrl: "/chat",
      createChat: () => chat,
    });

    runtime.pruneChats({
      activeSessionId: "active-session",
      liveSessionIds: ["active-session", "background-session"],
    });

    expect(runtime.getChat("background-session")).toBe(chat);
    expect(runtime.evictChat({ sessionId: "background-session" })).toBe(true);
    expect(runtime.getChat("background-session")).toBeNull();
  });

  it("refuses to evict unresolved client tool interaction", () => {
    const unresolvedMessages = [
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
      },
    ] as AgentUIMessage[];
    const runtime = createAgentChatRuntimeRegistry();
    const chat = createFakeChat({ messages: unresolvedMessages });
    runtime.getOrCreateChat({
      sessionId: "session",
      chatApiUrl: "/chat",
      createChat: () => chat,
    });

    expect(runtime.evictChat({ sessionId: "session" })).toBe(false);
    expect(runtime.hasUnresolvedToolCalls("session")).toBe(true);
    expect(runtime.getChat("session")).toBe(chat);
  });

  it("publishes sync errors through the runtime subscription", () => {
    const runtime = createAgentChatRuntimeRegistry();
    runtime.getOrCreateChat({
      sessionId: "session",
      chatApiUrl: "/chat",
      createChat: () => createFakeChat(),
    });
    const listener = vi.fn();
    runtime.subscribe(listener);
    const error = new Error("network failed");

    runtime.setSyncError("session", error);

    expect(runtime.getSyncError("session")).toBe(error);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
