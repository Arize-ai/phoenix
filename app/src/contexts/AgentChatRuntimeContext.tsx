import type { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { getUnresolvedToolCalls } from "@phoenix/agent/chat/interruptToolCalls";
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
  /** Returns whether a session already has a live browser transcript runtime. */
  hasChat: (sessionId: string) => boolean;
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
 * - inactive sessions are retained while a response or tool continuation is active
 * - inactive idle sessions can be evicted and later rehydrated from Relay
 */
export function shouldRetainChatRuntime({
  sessionId,
  activeSessionId,
  liveSessionIds,
  status,
  hasPendingToolOutput = false,
}: {
  sessionId: string;
  activeSessionId: string | null;
  liveSessionIds: Set<string>;
  status: ChatStatus;
  hasPendingToolOutput?: boolean;
}) {
  if (sessionId === activeSessionId) {
    return true;
  }
  if (!liveSessionIds.has(sessionId)) {
    return false;
  }
  return (
    status === "submitted" || status === "streaming" || hasPendingToolOutput
  );
}

const AgentChatRuntimeContext = createContext<AgentChatRuntime | null>(null);

/**
 * Hosts the long-lived AI SDK chat registry used by all agent chat surfaces.
 *
 * The important split is:
 * - React components are disposable view bindings
 * - AI SDK `Chat` instances are imperative runtimes owned here
 * - Relay hydrates committed transcripts and Zustand stores session metadata
 *
 * That lets requests continue while the visible surface moves between layouts,
 * while active work survives remounts and idle sessions rehydrate from Relay.
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
        // Defer initial status sync to avoid updating state during render,
        // which triggers React warnings and can break component lifecycles.
        queueMicrotask(() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        return chat;
      },
      hasChat: (sessionId) => chatRegistry.has(sessionId),
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
              hasPendingToolOutput:
                getUnresolvedToolCalls(entry.chat.messages).length > 0,
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
