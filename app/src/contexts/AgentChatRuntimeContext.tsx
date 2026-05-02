import type { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

type AgentChatRuntime = {
  /**
   * Returns the runtime-owned AI SDK chat for a session/model pair, creating or
   * replacing it when necessary.
   *
   * The registry key is the logical agent session id, while `chatApiUrl`
   * captures the currently selected model/transport. When the URL changes we
   * replace the runtime chat for that session instead of keeping multiple idle
   * variants alive.
   */
  getOrCreateChat: ({
    sessionId,
    chatApiUrl,
    createChat,
  }: {
    sessionId: string;
    chatApiUrl: string;
    createChat: () => Chat<AgentUIMessage>;
  }) => Chat<AgentUIMessage>;
  /**
   * Reconciles the runtime registry against current app state, reclaiming chats
   * that no longer need to remain imperative singletons.
   */
  pruneChats: ({
    activeSessionId,
    liveSessionIds,
  }: {
    activeSessionId: string | null;
    liveSessionIds: string[];
  }) => void;
};

/**
 * Retains chat runtimes only while they are still useful to the UI.
 *
 * Policy:
 * - deleted sessions are always evicted
 * - the active session is always retained, even when idle
 * - inactive sessions are retained only while a response is in flight so
 *   streaming can survive surface changes or session switches
 * - idle inactive sessions are reconstructed from store-backed messages when
 *   revisited, so their runtime can be reclaimed eagerly
 */
export function shouldRetainChatRuntime({
  sessionId,
  activeSessionId,
  liveSessionIds,
  status,
}: {
  sessionId: string;
  activeSessionId: string | null;
  liveSessionIds: Set<string>;
  status: ChatStatus;
}) {
  if (!liveSessionIds.has(sessionId)) {
    return false;
  }

  if (sessionId === activeSessionId) {
    return true;
  }

  return status === "submitted" || status === "streaming";
}

const AgentChatRuntimeContext = createContext<AgentChatRuntime | null>(null);

/**
 * Hosts the long-lived AI SDK chat registry used by all agent chat surfaces.
 *
 * The important split is:
 * - React components are disposable view bindings
 * - AI SDK `Chat` instances are imperative runtimes owned here
 * - Zustand remains the durable source of truth for session metadata/messages
 *
 * That lets requests continue while the visible surface moves between layouts,
 * while still allowing idle runtimes to be reclaimed and reconstructed from
 * store-backed state when revisited.
 */
export function AgentChatRuntimeProvider({ children }: PropsWithChildren) {
  const store = useAgentStore();
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const sessionIds = useAgentContext((state) => state.sessions);
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
        // not keep multiple chat variants per session alive; instead we detach
        // the old status subscription and let retention/pruning reclaim it.
        if (existingEntry) {
          existingEntry.unsubscribe();
        }

        const chat = createChat();
        // Mirror transient AI SDK status into the store so other surfaces
        // (session list, FAB, retention policy) can react without holding a
        // direct reference to the runtime instance.
        const unsubscribe = chat["~registerStatusCallback"](() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        chatRegistry.set(sessionId, { chatApiUrl, chat, unsubscribe });
        store.getState().setSessionChatStatus(sessionId, chat.status);
        return chat;
      },
      pruneChats: ({ activeSessionId, liveSessionIds }) => {
        const liveSessionIdSet = new Set(liveSessionIds);
        for (const sessionId of chatRegistry.keys()) {
          const entry = chatRegistry.get(sessionId);
          if (
            entry &&
            shouldRetainChatRuntime({
              sessionId,
              activeSessionId,
              liveSessionIds: liveSessionIdSet,
              status: entry.chat.status,
            })
          ) {
            continue;
          }

          // Once a chat no longer needs to remain runtime-resident, the store
          // becomes the only durable source of truth until the chat is created
          // again for a future surface/session visit.
          entry?.unsubscribe();
          chatRegistry.delete(sessionId);
          store.getState().setSessionChatStatus(sessionId, "ready");
        }
      },
    };
  });

  useEffect(() => {
    runtime.pruneChats({ activeSessionId, liveSessionIds: sessionIds });
  }, [activeSessionId, runtime, sessionIds]);

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
