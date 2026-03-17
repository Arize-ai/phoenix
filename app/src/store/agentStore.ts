import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ModelConfig } from "./playground/types";

/**
 * Layout position of the agent panel.
 * - "detached": floating overlay window
 * - "pinned": docked to the side of the viewport
 */
export type AgentPosition = "detached" | "pinned";

/**
 * A single message within an agent conversation.
 */
export type AgentMessage = {
  id: number;
  role: string;
  content: unknown;
};

/**
 * An agent conversation session containing messages, context references,
 * and its own model configuration (initially cloned from the default).
 */
export type AgentSession = {
  id: string;
  /** Brief human-readable summary of the conversation so far. */
  shortSummary: string;
  /** Ordered list of message IDs belonging to this session. */
  messageIds: number[];
  /** Contextual references (e.g. trace IDs, span IDs) attached to the session. */
  context: string[];
  /** Model configuration scoped to this session. */
  modelConfig: ModelConfig;
};

/** Auto-incrementing session ID counter. */
let agentSessionId = 0;
/** Returns the next unique session ID. */
export const generateSessionId = () => agentSessionId++;
/** Resets the session ID counter. Test-only. */
export const _resetSessionId = () => {
  agentSessionId = 0;
};

/** Auto-incrementing message ID counter. */
let agentMessageId = 1;
/** Returns the next unique message ID. */
export const generateAgentMessageId = () => agentMessageId++;
/** Resets the message ID counter. Test-only. */
export const _resetAgentMessageId = () => {
  agentMessageId = 1;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
  invocationParameters: [],
  supportedInvocationParameters: [],
};

/**
 * Serializable properties that define the agent's state.
 * These are the values persisted to local storage.
 */
export interface AgentProps {
  /** Whether the agent panel is currently visible. */
  isOpen: boolean;
  /** Current layout position of the agent panel. */
  position: AgentPosition;
  /** Ordered list of session IDs. */
  sessions: string[];
  /** ID of the currently active session, or null if none. */
  activeSessionId: string | null;
  /** Lookup table of sessions by their ID. */
  sessionMap: Record<string, AgentSession>;
  /** Lookup table of messages by their ID (shared across all sessions). */
  messageMap: Record<number, AgentMessage>;
  /** Default model configuration applied to newly created sessions. */
  defaultModelConfig: ModelConfig;
}

/**
 * Full agent state including props and all mutation actions.
 * Consumed via the AgentContext / useAgentContext hook.
 */
export interface AgentState extends AgentProps {
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setPosition: (position: AgentPosition) => void;
  createSession: () => string;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateSessionSummary: (sessionId: string, summary: string) => void;
  updateSessionModelConfig: (
    sessionId: string,
    patch: Partial<ModelConfig>
  ) => void;
  addSessionContext: (sessionId: string, context: string) => void;
  removeSessionContext: (sessionId: string, context: string) => void;
  addMessage: (sessionId: string, message: Omit<AgentMessage, "id">) => number;
  updateMessage: (messageId: number, patch: Partial<AgentMessage>) => void;
  deleteMessage: (sessionId: string, messageId: number) => void;
  setDefaultModelConfig: (config: ModelConfig) => void;
  clearAllSessions: () => void;
}

/**
 * Creates a Zustand store for managing agent UI state and conversation sessions.
 *
 * The store is wrapped with devtools (for Redux DevTools inspection) and
 * persist (to local storage under "arize-phoenix-agent"). The `isOpen`
 * property is excluded from persistence so the panel always starts closed.
 *
 * @param initialProps - Optional overrides for the default store properties.
 */
export const createAgentStore = (initialProps?: Partial<AgentProps>) => {
  const agentStore: StateCreator<
    AgentState,
    [["zustand/devtools", unknown]]
  > = (set) => ({
    isOpen: false,
    position: "detached",
    sessions: [],
    activeSessionId: null,
    sessionMap: {},
    messageMap: {},
    defaultModelConfig: { ...DEFAULT_MODEL_CONFIG },
    setIsOpen: (isOpen) => {
      set({ isOpen }, false, { type: "setIsOpen" });
    },
    toggleOpen: () => {
      set((state) => ({ isOpen: !state.isOpen }), false, {
        type: "toggleOpen",
      });
    },
    setPosition: (position) => {
      set({ position }, false, { type: "setPosition" });
    },
    createSession: () => {
      const sessionId = String(generateSessionId());
      set(
        (state) => {
          const session: AgentSession = {
            id: sessionId,
            shortSummary: "",
            messageIds: [],
            context: [],
            modelConfig: { ...state.defaultModelConfig },
          };
          return {
            sessions: [...state.sessions, sessionId],
            sessionMap: { ...state.sessionMap, [sessionId]: session },
            activeSessionId: sessionId,
          };
        },
        false,
        { type: "createSession" }
      );
      return sessionId;
    },
    deleteSession: (sessionId) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          const messageIdsToRemove = new Set(session.messageIds);
          const newMessageMap = { ...state.messageMap };
          for (const messageId of messageIdsToRemove) {
            delete newMessageMap[messageId];
          }
          const newSessionMap = { ...state.sessionMap };
          delete newSessionMap[sessionId];
          const newSessions = state.sessions.filter((id) => id !== sessionId);
          const newActiveSessionId =
            state.activeSessionId === sessionId
              ? (newSessions[newSessions.length - 1] ?? null)
              : state.activeSessionId;
          return {
            sessions: newSessions,
            sessionMap: newSessionMap,
            messageMap: newMessageMap,
            activeSessionId: newActiveSessionId,
          };
        },
        false,
        { type: "deleteSession" }
      );
    },
    setActiveSession: (sessionId) => {
      set({ activeSessionId: sessionId }, false, { type: "setActiveSession" });
    },
    updateSessionSummary: (sessionId, summary) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          return {
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: { ...session, shortSummary: summary },
            },
          };
        },
        false,
        { type: "updateSessionSummary" }
      );
    },
    updateSessionModelConfig: (sessionId, patch) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          return {
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: {
                ...session,
                modelConfig: { ...session.modelConfig, ...patch },
              },
            },
          };
        },
        false,
        { type: "updateSessionModelConfig" }
      );
    },
    addSessionContext: (sessionId, context) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          return {
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: {
                ...session,
                context: [...session.context, context],
              },
            },
          };
        },
        false,
        { type: "addSessionContext" }
      );
    },
    removeSessionContext: (sessionId, context) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          return {
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: {
                ...session,
                context: session.context.filter((item) => item !== context),
              },
            },
          };
        },
        false,
        { type: "removeSessionContext" }
      );
    },
    addMessage: (sessionId, message) => {
      const messageId = generateAgentMessageId();
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          const newMessage: AgentMessage = { ...message, id: messageId };
          return {
            messageMap: { ...state.messageMap, [messageId]: newMessage },
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: {
                ...session,
                messageIds: [...session.messageIds, messageId],
              },
            },
          };
        },
        false,
        { type: "addMessage" }
      );
      return messageId;
    },
    updateMessage: (messageId, patch) => {
      set(
        (state) => {
          const message = state.messageMap[messageId];
          if (!message) return state;
          return {
            messageMap: {
              ...state.messageMap,
              [messageId]: { ...message, ...patch, id: messageId },
            },
          };
        },
        false,
        { type: "updateMessage" }
      );
    },
    deleteMessage: (sessionId, messageId) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          const newMessageMap = { ...state.messageMap };
          delete newMessageMap[messageId];
          return {
            messageMap: newMessageMap,
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: {
                ...session,
                messageIds: session.messageIds.filter((id) => id !== messageId),
              },
            },
          };
        },
        false,
        { type: "deleteMessage" }
      );
    },
    setDefaultModelConfig: (config) => {
      set({ defaultModelConfig: config }, false, {
        type: "setDefaultModelConfig",
      });
    },
    clearAllSessions: () => {
      set(
        {
          sessions: [],
          activeSessionId: null,
          sessionMap: {},
          messageMap: {},
        },
        false,
        { type: "clearAllSessions" }
      );
    },
    ...initialProps,
  });

  return create<AgentState>()(
    persist(devtools(agentStore, { name: "agentStore" }), {
      name: "arize-phoenix-agent",
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isOpen, ...rest } = state;
        // Only persist data props, not actions
        return {
          position: rest.position,
          sessions: rest.sessions,
          activeSessionId: rest.activeSessionId,
          sessionMap: rest.sessionMap,
          messageMap: rest.messageMap,
          defaultModelConfig: rest.defaultModelConfig,
        };
      },
    })
  );
};

export type AgentStore = ReturnType<typeof createAgentStore>;
