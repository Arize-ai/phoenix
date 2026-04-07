import type { Chat, UIMessage } from "@ai-sdk/react";
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
  removeChatsForSession: (sessionId: string) => void;
  pruneChats: (liveSessionIds: string[]) => void;
};

const AgentChatRuntimeContext = createContext<AgentChatRuntime | null>(null);

export function AgentChatRuntimeProvider({ children }: PropsWithChildren) {
  const store = useAgentStore();
  const sessionIds = useAgentContext((state) => state.sessions);
  const [runtime] = useState<AgentChatRuntime>(() => {
    const chatRegistry = new Map<
      string,
      { chatApiUrl: string; chat: Chat<UIMessage> }
    >();

    return {
      getOrCreateChat: ({ sessionId, chatApiUrl, createChat }) => {
        const existingEntry = chatRegistry.get(sessionId);
        if (existingEntry && existingEntry.chatApiUrl === chatApiUrl) {
          return existingEntry.chat;
        }

        const chat = createChat();
        chat["~registerStatusCallback"](() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        chatRegistry.set(sessionId, { chatApiUrl, chat });
        store.getState().setSessionChatStatus(sessionId, chat.status);
        return chat;
      },
      removeChatsForSession: (sessionId) => {
        chatRegistry.delete(sessionId);
        store.getState().setSessionChatStatus(sessionId, "ready");
      },
      pruneChats: (liveSessionIds) => {
        const liveSessionIdSet = new Set(liveSessionIds);
        for (const sessionId of chatRegistry.keys()) {
          if (!liveSessionIdSet.has(sessionId)) {
            chatRegistry.delete(sessionId);
            store.getState().setSessionChatStatus(sessionId, "ready");
          }
        }
      },
    };
  });

  useEffect(() => {
    runtime.pruneChats(sessionIds);
  }, [runtime, sessionIds]);

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
