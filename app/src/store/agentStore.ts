import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ModelConfig } from "./playground/types";

export type AgentPosition = "detached" | "pinned";

export type AgentMessage = {
  id: number;
  role: string;
  content: unknown;
};

export type AgentSession = {
  id: string;
  shortSummary: string;
  messageIds: number[];
  context: string[];
  modelConfig: ModelConfig;
};

let agentSessionId = 0;
export const generateSessionId = () => agentSessionId++;
export const _resetSessionId = () => {
  agentSessionId = 0;
};

let agentMessageId = 1;
export const generateAgentMessageId = () => agentMessageId++;
export const _resetAgentMessageId = () => {
  agentMessageId = 1;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
  invocationParameters: [],
  supportedInvocationParameters: [],
};

export interface AgentProps {
  isOpen: boolean;
  position: AgentPosition;
  sessions: string[];
  activeSessionId: string | null;
  sessionMap: Record<string, AgentSession>;
  messageMap: Record<number, AgentMessage>;
  defaultModelConfig: ModelConfig;
}

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
