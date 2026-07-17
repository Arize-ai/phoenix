import type { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { getUnresolvedToolCalls } from "@phoenix/agent/chat/interruptToolCalls";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

export type AgentChatRuntime = {
  /** Returns the live overlay for a session without creating one. */
  getChat: (sessionId: string) => Chat<AgentUIMessage> | null;
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
   * Evicts a live overlay once Relay owns the canonical transcript. Returns
   * false when unresolved client tool interaction still requires the runtime.
   */
  evictChat: ({
    sessionId,
    expectedChat,
  }: {
    sessionId: string;
    expectedChat?: Chat<AgentUIMessage>;
  }) => boolean;
  getStatus: (sessionId: string) => ChatStatus;
  hasUnresolvedToolCalls: (sessionId: string) => boolean;
  getSyncError: (sessionId: string) => Error | null;
  setSyncError: (sessionId: string, error: Error | null) => void;
  hasActiveChat: () => boolean;
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
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

const AgentChatRuntimeContext = createContext<AgentChatRuntime | null>(null);

const EMPTY_AGENT_CHAT_RUNTIME: AgentChatRuntime = {
  getChat: () => null,
  getOrCreateChat: () => {
    throw new Error("Missing AgentChatRuntimeContext.Provider in the tree");
  },
  evictChat: () => false,
  getStatus: () => "ready",
  hasUnresolvedToolCalls: () => false,
  getSyncError: () => null,
  setSyncError: () => undefined,
  hasActiveChat: () => false,
  subscribe: () => () => undefined,
  getVersion: () => 0,
  pruneChats: () => undefined,
};

export function createAgentChatRuntimeRegistry(): AgentChatRuntime {
  const chatRegistry = new Map<
    string,
    {
      chatApiUrl: string;
      chat: Chat<AgentUIMessage>;
      syncError: Error | null;
      unsubscribe: () => void;
    }
  >();
  const listeners = new Set<() => void>();
  let version = 0;
  const notifyListeners = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  const forceEvictChat = (sessionId: string) => {
    const entry = chatRegistry.get(sessionId);
    if (!entry) {
      return false;
    }
    entry.unsubscribe();
    chatRegistry.delete(sessionId);
    notifyListeners();
    return true;
  };

  return {
    getChat: (sessionId) => chatRegistry.get(sessionId)?.chat ?? null,
    getOrCreateChat: ({ sessionId, chatApiUrl, createChat }) => {
      const existingEntry = chatRegistry.get(sessionId);
      if (existingEntry && existingEntry.chatApiUrl === chatApiUrl) {
        return existingEntry.chat;
      }
      if (existingEntry) {
        existingEntry.unsubscribe();
      }

      const chat = createChat();
      const unsubscribeStatus = chat["~registerStatusCallback"](() => {
        notifyListeners();
      });
      const unsubscribeMessages = chat["~registerMessagesCallback"](() => {
        notifyListeners();
      });
      chatRegistry.set(sessionId, {
        chatApiUrl,
        chat,
        syncError: null,
        unsubscribe: () => {
          unsubscribeStatus();
          unsubscribeMessages();
        },
      });
      notifyListeners();
      return chat;
    },
    evictChat: ({ sessionId, expectedChat }) => {
      const entry = chatRegistry.get(sessionId);
      if (
        !entry ||
        (expectedChat && entry.chat !== expectedChat) ||
        isActiveChatStatus(entry.chat.status) ||
        getUnresolvedToolCalls(entry.chat.messages).length > 0
      ) {
        return false;
      }
      return forceEvictChat(sessionId);
    },
    getStatus: (sessionId) =>
      chatRegistry.get(sessionId)?.chat.status ?? "ready",
    hasUnresolvedToolCalls: (sessionId) => {
      const chat = chatRegistry.get(sessionId)?.chat;
      return chat ? getUnresolvedToolCalls(chat.messages).length > 0 : false;
    },
    getSyncError: (sessionId) => chatRegistry.get(sessionId)?.syncError ?? null,
    setSyncError: (sessionId, error) => {
      const entry = chatRegistry.get(sessionId);
      if (!entry || entry.syncError === error) {
        return;
      }
      entry.syncError = error;
      notifyListeners();
    },
    hasActiveChat: () =>
      Array.from(chatRegistry.values()).some(({ chat }) =>
        isActiveChatStatus(chat.status)
      ),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    pruneChats: ({ liveSessionIds }) => {
      const liveSessionIdSet = new Set(liveSessionIds);
      for (const sessionId of chatRegistry.keys()) {
        if (!liveSessionIdSet.has(sessionId)) {
          forceEvictChat(sessionId);
        }
      }
    },
  };
}

/**
 * Hosts the long-lived AI SDK chat registry used by all agent chat surfaces.
 *
 * The important split is:
 * - React components are disposable view bindings
 * - AI SDK `Chat` instances are imperative runtimes owned here
 * - Relay owns persisted sessions while Zustand stores ephemeral UI settings
 *
 * That lets requests continue while the visible surface moves between layouts,
 * while active work survives remounts and idle sessions rehydrate from Relay.
 */
export function AgentChatRuntimeProvider({ children }: PropsWithChildren) {
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const sessionStateById = useAgentContext((state) => state.sessionStateById);
  const [runtime] = useState<AgentChatRuntime>(createAgentChatRuntimeRegistry);

  useEffect(() => {
    runtime.pruneChats({
      activeSessionId,
      liveSessionIds: Object.keys(sessionStateById),
    });
  }, [activeSessionId, runtime, sessionStateById]);

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

export function useAgentChatRuntimeVersion(): AgentChatRuntime {
  const runtime =
    useContext(AgentChatRuntimeContext) ?? EMPTY_AGENT_CHAT_RUNTIME;
  useSyncExternalStore(
    runtime.subscribe,
    runtime.getVersion,
    runtime.getVersion
  );
  return runtime;
}

export function useAgentChatStatus(sessionId: string | null): ChatStatus {
  const runtime = useAgentChatRuntimeVersion();
  const operation = useAgentContext((state) =>
    sessionId ? state.sessionOperationById[sessionId] : undefined
  );
  if (operation === "creating") {
    return "submitted";
  }
  return sessionId ? runtime.getStatus(sessionId) : "ready";
}

export function useAnyAgentChatActive(): boolean {
  const runtime = useAgentChatRuntimeVersion();
  const hasSessionOperation = useAgentContext(
    (state) => Object.keys(state.sessionOperationById).length > 0
  );
  return runtime.hasActiveChat() || hasSessionOperation;
}

function isActiveChatStatus(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}
