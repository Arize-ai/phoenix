import type { Chat } from "@ai-sdk/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

type AgentChatRuntime = {
  /**
   * Returns the runtime-owned AI SDK chat for a session/model pair, creating or
   * replacing it when necessary.
   *
   * The registry key is the session's Relay node ID, while `chatApiUrl`
   * captures the currently selected model/transport. When the URL changes we
   * replace the runtime chat for that session instead of keeping multiple idle
   * variants alive; the replacement is seeded with the previous instance's
   * messages so the visible conversation carries over.
   */
  getOrCreateChat: ({
    sessionId,
    chatApiUrl,
    createChat,
  }: {
    sessionId: string;
    chatApiUrl: string;
    createChat: (
      previousMessages: AgentUIMessage[] | null
    ) => Chat<AgentUIMessage>;
  }) => Chat<AgentUIMessage>;
  /** Returns the resident chat for a session, if one exists. */
  getChat: (sessionId: string) => Chat<AgentUIMessage> | null;
  /**
   * Drops a session's runtime chat, e.g. when the session is deleted. The
   * transcript's durable copy lives on the server.
   */
  evictChat: (sessionId: string) => void;
};

const AgentChatRuntimeContext = createContext<AgentChatRuntime | null>(null);

/**
 * Hosts the long-lived AI SDK chat registry used by all agent chat surfaces.
 *
 * The important split is:
 * - React components are disposable view bindings
 * - AI SDK `Chat` instances are imperative runtimes owned here
 * - Relay is the durable source of truth for session identity and transcripts
 *
 * A chat is created the first time a session's surface binds to it — seeded
 * from the Relay-fetched transcript — and stays resident until the session is
 * deleted, so requests continue while the visible surface moves between
 * layouts and unsent local state (e.g. an unsent branch) is not lost when the
 * user switches sessions.
 */
export function AgentChatRuntimeProvider({ children }: PropsWithChildren) {
  const store = useAgentStore();
  const [runtime] = useState<AgentChatRuntime>(() => {
    const chatRegistry = new Map<
      string,
      {
        chatApiUrl: string;
        chat: Chat<AgentUIMessage>;
        unsubscribe: () => void;
      }
    >();

    return {
      getOrCreateChat: ({ sessionId, chatApiUrl, createChat }) => {
        const existingEntry = chatRegistry.get(sessionId);
        if (existingEntry && existingEntry.chatApiUrl === chatApiUrl) {
          return existingEntry.chat;
        }

        // A model/transport swap replaces the runtime for this session. We do
        // not keep multiple chat variants per session alive; the replacement
        // inherits the previous instance's messages.
        if (existingEntry) {
          existingEntry.unsubscribe();
        }

        const chat = createChat(existingEntry?.chat.messages ?? null);
        // Mirror transient AI SDK status into the store so other surfaces
        // (session list, FAB) can react without holding a direct reference to
        // the runtime instance.
        const unsubscribe = chat["~registerStatusCallback"](() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        chatRegistry.set(sessionId, { chatApiUrl, chat, unsubscribe });
        // Defer initial status sync to avoid updating state during render,
        // which triggers React warnings and can break component lifecycles.
        queueMicrotask(() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        return chat;
      },
      getChat: (sessionId) => chatRegistry.get(sessionId)?.chat ?? null,
      evictChat: (sessionId) => {
        const entry = chatRegistry.get(sessionId);
        if (!entry) {
          return;
        }
        entry.unsubscribe();
        chatRegistry.delete(sessionId);
      },
    };
  });

  return (
    <AgentChatRuntimeContext.Provider value={runtime}>
      {children}
    </AgentChatRuntimeContext.Provider>
  );
}

export function useAgentChatRuntime() {
  const runtime = useContext(AgentChatRuntimeContext);
  if (!runtime) {
    throw new Error("Missing AgentChatRuntimeContext.Provider in the tree");
  }
  return runtime;
}
