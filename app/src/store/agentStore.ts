import type { UIMessage } from "ai";
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
 * An agent conversation session containing messages, context references,
 * and its own model configuration (initially cloned from the default).
 */
export type AgentSession = {
  id: string;
  /** Brief human-readable summary of the conversation so far. */
  shortSummary: string;
  /** Messages in AI SDK UIMessage format. */
  messages: UIMessage[];
  /** Contextual references (e.g. trace IDs, span IDs) attached to the session. */
  context: string[];
  /** Model configuration scoped to this session. */
  modelConfig: ModelConfig;
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
  setSessionMessages: (sessionId: string, messages: UIMessage[]) => void;
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
      const sessionId = crypto.randomUUID();
      set(
        (state) => {
          const session: AgentSession = {
            id: sessionId,
            shortSummary: "",
            messages: [],
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
    setSessionMessages: (sessionId, messages) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          return {
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: { ...session, messages },
            },
          };
        },
        false,
        { type: "setSessionMessages" }
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
      partialize: (state) => ({
        isOpen: state.isOpen,
        position: state.position,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        sessionMap: state.sessionMap,
        defaultModelConfig: state.defaultModelConfig,
      }),
    })
  );
};

export type AgentStore = ReturnType<typeof createAgentStore>;
