import type { Chat, UIMessage } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

type AgentChatRuntime = {
  getOrCreateChat: ({
    sessionId,
    chatApiUrl,
    createChat,
  }: {
    sessionId: string;
    chatApiUrl: string;
    createChat: () => Chat<UIMessage>;
  }) => Chat<UIMessage>;
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

export function AgentChatRuntimeProvider({ children }: PropsWithChildren) {
  const store = useAgentStore();
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const sessionIds = useAgentContext((state) => state.sessions);
  const [runtime] = useState<AgentChatRuntime>(() => {
    const chatRegistry = new Map<
      string,
      { chatApiUrl: string; chat: Chat<UIMessage>; unsubscribe: () => void }
    >();

    return {
      getOrCreateChat: ({ sessionId, chatApiUrl, createChat }) => {
        const existingEntry = chatRegistry.get(sessionId);
        if (existingEntry && existingEntry.chatApiUrl === chatApiUrl) {
          return existingEntry.chat;
        }

        // Clean up the previous chat's status callback before replacing
        if (existingEntry) {
          existingEntry.unsubscribe();
        }

        const chat = createChat();
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
