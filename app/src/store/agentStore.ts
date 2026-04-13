import type { ChatStatus, UIMessage } from "ai";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { AGENT_SYSTEM_PROMPT } from "@phoenix/agent/chat/systemPrompt";
import type { PendingElicitation } from "@phoenix/agent/tools/elicit";

import type { ModelConfig } from "./playground/types";

/**
 * Layout position of the agent panel.
 * - "detached": floating overlay window
 * - "pinned": docked to the side of the viewport
 */
export type AgentPosition = "detached" | "pinned";

/**
 * Which surface currently hosts the agent chat panel.
 * - "docked": the resizable panel in the main layout
 * - "trace": the embedded panel inside a trace slideover
 *
 * When a surface mounts it claims the active location; the Layout uses this
 * to decide whether to render the docked panel (only when no other surface
 * has claimed the location).
 */
export type AgentPanelLocation = "docked" | "trace";

export interface AgentDebugSettings {
  retainInactiveBashSessions: boolean;
}

const DEFAULT_AGENT_DEBUG_SETTINGS: AgentDebugSettings = {
  retainInactiveBashSessions: false,
};

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
  /** Unix timestamp (ms) when the session was created. 0 for legacy sessions. */
  createdAt: number;
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
  /**
   * Which surface currently hosts the agent chat panel.
   * Defaults to "docked". Set to "trace" when a trace slideover mounts its
   * own embedded chat panel, which suppresses the docked panel in Layout.
   * This field is ephemeral and not persisted.
   */
  activePanelLocation: AgentPanelLocation;
  /** Ordered list of session IDs. */
  sessions: string[];
  /** ID of the currently active session, or null if none. */
  activeSessionId: string | null;
  /** Lookup table of sessions by their ID. */
  sessionMap: Record<string, AgentSession>;
  /** Default model configuration applied to newly created sessions. */
  defaultModelConfig: ModelConfig;
  /**
   * System instructions sent with PXI agent chat requests (editable in Settings).
   * Defaults to the built-in {@link AGENT_SYSTEM_PROMPT}.
   */
  systemPrompt: string;
  /** Debug-only runtime flags for temporary agent behavior overrides. */
  debug: AgentDebugSettings;
}

/**
 * Full agent state including props and all mutation actions.
 * Consumed via the AgentContext / useAgentContext hook.
 */
export interface AgentState extends AgentProps {
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setPosition: (position: AgentPosition) => void;
  setActivePanelLocation: (location: AgentPanelLocation) => void;
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
  setSystemPrompt: (systemPrompt: string) => void;
  clearAllSessions: () => void;

  // -- Elicitation (ephemeral, not persisted) --

  /**
   * Pending elicitations keyed by session ID. Each session can have at most
   * one pending elicitation at a time. Set by the ask_user tool handler and
   * cleared when the user submits answers or dismisses the carousel.
   */
  pendingElicitationBySessionId: Record<string, PendingElicitation>;
  setPendingElicitation: (
    sessionId: string,
    elicitation: PendingElicitation | null
  ) => void;
  chatStatusBySessionId: Record<string, ChatStatus>;
  setSessionChatStatus: (sessionId: string, status: ChatStatus) => void;
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
    activePanelLocation: "docked",
    sessions: [],
    activeSessionId: null,
    sessionMap: {},
    defaultModelConfig: { ...DEFAULT_MODEL_CONFIG },
    systemPrompt: AGENT_SYSTEM_PROMPT,
    debug: { ...DEFAULT_AGENT_DEBUG_SETTINGS },
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
    setActivePanelLocation: (location) => {
      set({ activePanelLocation: location }, false, {
        type: "setActivePanelLocation",
      });
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
            createdAt: Date.now(),
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
          const newPendingElicitationBySessionId = {
            ...state.pendingElicitationBySessionId,
          };
          delete newPendingElicitationBySessionId[sessionId];
          const newChatStatusBySessionId = { ...state.chatStatusBySessionId };
          delete newChatStatusBySessionId[sessionId];
          const newSessions = state.sessions.filter((id) => id !== sessionId);
          const newActiveSessionId =
            state.activeSessionId === sessionId
              ? (newSessions[newSessions.length - 1] ?? null)
              : state.activeSessionId;
          return {
            sessions: newSessions,
            sessionMap: newSessionMap,
            activeSessionId: newActiveSessionId,
            pendingElicitationBySessionId: newPendingElicitationBySessionId,
            chatStatusBySessionId: newChatStatusBySessionId,
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
    setSystemPrompt: (systemPrompt) => {
      set({ systemPrompt }, false, { type: "setSystemPrompt" });
    },
    clearAllSessions: () => {
      set(
        {
          sessions: [],
          activeSessionId: null,
          sessionMap: {},
          pendingElicitationBySessionId: {},
          chatStatusBySessionId: {},
        },
        false,
        { type: "clearAllSessions" }
      );
    },

    // -- Elicitation (ephemeral) --
    pendingElicitationBySessionId: {},
    setPendingElicitation: (sessionId, elicitation) => {
      set(
        (state) => {
          const next = { ...state.pendingElicitationBySessionId };
          if (elicitation) {
            next[sessionId] = elicitation;
          } else {
            delete next[sessionId];
          }
          return { pendingElicitationBySessionId: next };
        },
        false,
        { type: "setPendingElicitation" }
      );
    },

    chatStatusBySessionId: {},
    setSessionChatStatus: (sessionId, status) => {
      set(
        (state) => ({
          chatStatusBySessionId: {
            ...state.chatStatusBySessionId,
            [sessionId]: status,
          },
        }),
        false,
        { type: "setSessionChatStatus" }
      );
    },

    ...initialProps,
  });

  return create<AgentState>()(
    persist(devtools(agentStore, { name: "agentStore" }), {
      name: "arize-phoenix-agent",
      version: 2,
      migrate: (persisted, version) => {
        let next = persisted as AgentProps & { systemPrompt?: string };
        if (version === 0) {
          // Legacy sessions may not have `createdAt`. Backfill with 0 so the
          // UI can distinguish them from sessions created after this migration.
          const state = persisted as AgentProps;
          const migratedSessionMap: Record<string, AgentSession> = {};
          for (const [sessionId, session] of Object.entries(
            state.sessionMap ?? {}
          )) {
            migratedSessionMap[sessionId] = {
              ...session,
              createdAt: (session as AgentSession).createdAt ?? 0,
            };
          }
          next = { ...state, sessionMap: migratedSessionMap };
        }
        if (version < 2) {
          next = {
            ...next,
            systemPrompt: next.systemPrompt ?? AGENT_SYSTEM_PROMPT,
          };
        }
        return next as AgentState;
      },
      partialize: (state) => ({
        isOpen: state.isOpen,
        position: state.position,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        sessionMap: state.sessionMap,
        defaultModelConfig: state.defaultModelConfig,
        systemPrompt: state.systemPrompt,
        debug: state.debug,
      }),
    })
  );
};

export type AgentStore = ReturnType<typeof createAgentStore>;
