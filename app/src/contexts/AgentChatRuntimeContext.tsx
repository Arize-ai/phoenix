import type { Chat } from "@ai-sdk/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { SessionEventsBridge } from "@phoenix/agent/chat/sessionEventsBridge";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

export type AgentSessionChatRuntime = {
  chat: Chat<AgentUIMessage>;
  clientId: string;
  eventsBridge: SessionEventsBridge;
};

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
  getOrCreateSessionRuntime: ({
    sessionId,
    chatApiUrl,
    eventsApiUrl,
    createChat,
  }: {
    sessionId: string;
    chatApiUrl: string;
    eventsApiUrl: string;
    createChat: (options: {
      previousMessages: AgentUIMessage[] | null;
      clientId: string;
      eventsBridge: SessionEventsBridge;
    }) => Chat<AgentUIMessage>;
  }) => AgentSessionChatRuntime;
  /** Attaches a mounted session surface to its event bridge. */
  acquireSession: (sessionId: string) => void;
  /** Releases a mounted surface and starts the 30-second runtime linger. */
  releaseSession: (sessionId: string) => void;
  /** Returns the resident chat for a session, if one exists. */
  getChat: (sessionId: string) => Chat<AgentUIMessage> | null;
  /**
   * Drops a session's runtime chat, e.g. when the session is deleted. The
   * transcript's durable copy lives on the server.
   */
  evictChat: (sessionId: string) => void;
  /** Disposes every runtime when the authenticated app root unmounts. */
  dispose: () => void;
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
 * released. A short linger keeps requests and unsent state alive while the
 * visible surface moves between layouts, after which the detached server turn
 * remains recoverable through the session event stream.
 */
export function AgentChatRuntimeProvider({ children }: PropsWithChildren) {
  const store = useAgentStore();
  const disposeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [runtime] = useState<AgentChatRuntime>(() => {
    const chatRegistry = new Map<
      string,
      {
        chatApiUrl: string;
        chat: Chat<AgentUIMessage>;
        clientId: string;
        eventsBridge: SessionEventsBridge;
        refCount: number;
        lingerTimer: ReturnType<typeof setTimeout> | null;
        unsubscribe: () => void;
      }
    >();

    const destroyEntry = (sessionId: string) => {
      const entry = chatRegistry.get(sessionId);
      if (!entry) {
        return;
      }
      if (entry.lingerTimer != null) {
        clearTimeout(entry.lingerTimer);
      }
      entry.unsubscribe();
      entry.eventsBridge.dispose();
      chatRegistry.delete(sessionId);
      store.getState().setSessionChatStatus(sessionId, "ready");
    };

    return {
      getOrCreateSessionRuntime: ({
        sessionId,
        chatApiUrl,
        eventsApiUrl,
        createChat,
      }) => {
        const existingEntry = chatRegistry.get(sessionId);
        if (existingEntry && existingEntry.chatApiUrl === chatApiUrl) {
          return existingEntry;
        }

        // A model/transport swap replaces the runtime for this session. We do
        // not keep multiple chat variants per session alive; the replacement
        // inherits the previous instance's messages.
        if (existingEntry) {
          destroyEntry(sessionId);
        }

        const clientId = crypto.randomUUID();
        const eventsBridge = new SessionEventsBridge({
          sessionId,
          eventsApiUrl,
          clientId,
          agentStore: store,
        });
        const chat = createChat({
          previousMessages: existingEntry?.chat.messages ?? null,
          clientId,
          eventsBridge,
        });
        // Mirror transient AI SDK status into the store so other surfaces
        // (session list, FAB) can react without holding a direct reference to
        // the runtime instance.
        const unsubscribe = chat["~registerStatusCallback"](() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        const entry = {
          chatApiUrl,
          chat,
          clientId,
          eventsBridge,
          refCount: 0,
          lingerTimer: null,
          unsubscribe,
        };
        chatRegistry.set(sessionId, entry);
        // Defer initial status sync to avoid updating state during render,
        // which triggers React warnings and can break component lifecycles.
        queueMicrotask(() => {
          store.getState().setSessionChatStatus(sessionId, chat.status);
        });
        return entry;
      },
      acquireSession: (sessionId) => {
        const entry = chatRegistry.get(sessionId);
        if (!entry) {
          return;
        }
        entry.refCount += 1;
        if (entry.lingerTimer != null) {
          clearTimeout(entry.lingerTimer);
          entry.lingerTimer = null;
        }
        entry.eventsBridge.start();
      },
      releaseSession: (sessionId) => {
        const entry = chatRegistry.get(sessionId);
        if (!entry) {
          return;
        }
        entry.refCount = Math.max(0, entry.refCount - 1);
        if (entry.refCount > 0 || entry.lingerTimer != null) {
          return;
        }
        entry.lingerTimer = setTimeout(() => {
          const currentEntry = chatRegistry.get(sessionId);
          if (currentEntry === entry && entry.refCount === 0) {
            destroyEntry(sessionId);
          }
        }, 30_000);
      },
      getChat: (sessionId) => chatRegistry.get(sessionId)?.chat ?? null,
      evictChat: (sessionId) => {
        destroyEntry(sessionId);
      },
      dispose: () => {
        for (const sessionId of chatRegistry.keys()) {
          destroyEntry(sessionId);
        }
      },
    };
  });

  useEffect(() => {
    if (disposeTimerRef.current != null) {
      clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }
    return () => {
      disposeTimerRef.current = setTimeout(() => runtime.dispose(), 0);
    };
  }, [runtime]);

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
