import type { ChatStatus } from "ai";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import {
  agentContextKey,
  type AgentContext,
} from "@phoenix/agent/context/agentContextTypes";
import {
  createDefaultAgentCapabilities,
  type AgentCapabilities,
  type AgentCapabilityKey,
} from "@phoenix/agent/extensions/capabilities";
import type { PendingBatchSpanAnnotate } from "@phoenix/agent/tools/batchSpanAnnotate";
import type { PendingElicitation } from "@phoenix/agent/tools/elicit";
import type { PendingPromptEdit } from "@phoenix/agent/tools/playgroundPrompt";
import type { PendingSavePrompt } from "@phoenix/agent/tools/playgroundSavePrompt";
import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { ModelConfig } from "./playground/types";

/**
 * Layout position of the agent panel.
 * - "detached": floating overlay panel
 * - "pinned": docked to the side of the viewport
 */
export type AgentPosition = "detached" | "pinned";

/** Pinned corner for the global PXI floating action button. */
export type AgentFabPlacement =
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end";

/** Server-provided PXI configuration exposed to the frontend. */
export type AgentServerConfig = {
  /** Remote collector used for optional agent trace export. */
  collectorEndpoint: string | null;
  /** Local Phoenix project used for PXI trace persistence. */
  assistantProjectName: string;
  /** Whether this Phoenix instance allows PXI web search/fetch. */
  webAccessEnabled: boolean;
};

/**
 * Per-user PXI observability preferences persisted in local storage.
 *
 * These settings control where PXI traces are sent for the current browser
 * user and whether the one-time consent gate has been acknowledged.
 */
export type AgentObservabilitySettings = {
  /** Whether PXI traces should be persisted in the current Phoenix instance. */
  storeLocalTraces: boolean;
  /** Whether PXI traces should also be exported to a remote collector. */
  exportRemoteTraces: boolean;
  /** Whether the user has acknowledged the PXI consent gate. */
  hasAcknowledgedConsent: boolean;
};

export type AgentEditPermissionMode = "manual" | "bypass";

export type AgentPermissions = {
  /** How user-visible edit approvals should be resolved. */
  edits: AgentEditPermissionMode;
};

/**
 * Usage metrics like token usage.
 *
 * May be extended to costs, tool call count, etc
 */
export type AgentSessionUsage = {
  tokenCount: {
    prompt: number;
    completion: number;
    total: number;
    promptDetails?: {
      cacheRead: number;
      cacheWrite: number;
    };
  };
  // this can be extended with cost in the future
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
  messages: AgentUIMessage[];
  /** Contextual references (e.g. trace IDs, span IDs) attached to the session. */
  context: string[];
  /** Model configuration scoped to this session. */
  modelConfig: ModelConfig;
  /** Unix timestamp (ms) when the session was created. 0 for legacy sessions. */
  createdAt: number;
  /** Usage metrics returned as metadata from llm invocations */
  usage?: AgentSessionUsage;
};

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
  invocationParameters: getDefaultInvocationConfig("ANTHROPIC"),
};

const DEFAULT_AGENT_SERVER_CONFIG: AgentServerConfig = {
  collectorEndpoint: null,
  assistantProjectName: "assistant_agent",
  webAccessEnabled: false,
};

const DEFAULT_AGENT_OBSERVABILITY_SETTINGS: AgentObservabilitySettings = {
  storeLocalTraces: true,
  exportRemoteTraces: false,
  hasAcknowledgedConsent: false,
};

const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  edits: "manual",
};

const MAX_STORED_AGENT_SESSIONS = 3;

/**
 * Serializable properties that define the agent's state.
 * These are the values persisted to local storage.
 */
export interface AgentProps {
  /** Whether the agent panel is currently visible. */
  isOpen: boolean;
  /** Current layout position of the agent panel. */
  position: AgentPosition;
  /** Pinned corner for the global PXI floating action button. */
  fabPlacement: AgentFabPlacement;
  /** Ordered list of session IDs. */
  sessions: string[];
  /** ID of the currently active session, or null if none. */
  activeSessionId: string | null;
  /** Lookup table of sessions by their ID. */
  sessionMap: Record<string, AgentSession>;
  /** Default model configuration applied to newly created sessions. */
  defaultModelConfig: ModelConfig;
  /** Server-provided PXI config used to describe trace destinations in the UI. */
  agentsConfig: AgentServerConfig;
  /** Per-user PXI observability preferences and consent acknowledgement state. */
  observability: AgentObservabilitySettings;
  /** Per-user permissions for approval-gated tool actions. */
  permissions: AgentPermissions;
  /** Typed runtime capabilities that influence tool and session behavior. */
  capabilities: AgentCapabilities;
}

/**
 * Full agent state including props and all mutation actions.
 * Consumed via the AgentContext / useAgentContext hook.
 */
export interface AgentState extends AgentProps {
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setPosition: (position: AgentPosition) => void;
  setFabPlacement: (placement: AgentFabPlacement) => void;
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
  setSessionMessages: (sessionId: string, messages: AgentUIMessage[]) => void;
  setDefaultModelConfig: (config: ModelConfig) => void;
  setObservability: (patch: Partial<AgentObservabilitySettings>) => void;
  setPermissions: (patch: Partial<AgentPermissions>) => void;
  acknowledgeConsent: () => void;
  clearAllSessions: () => void;
  setCapability: (params: {
    key: AgentCapabilityKey;
    enabled: boolean;
  }) => void;

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
  setSessionUsage: (
    sessionId: string,
    newUsage: {
      prompt: number;
      completion: number;
      total?: number;
      promptDetails?: { cacheRead: number; cacheWrite: number };
    }
  ) => void;

  // -- Page and mounted contexts advertised with /chat (ephemeral) --
  //
  // Both slices are rebuilt from the UI each render — they are never
  // persisted. `selectActiveContexts` merges and dedupes them for each chat
  // turn so the agent sees a single flat list of typed contexts.

  /** Derived from route params by `AgentContextSync` on navigation. */
  routeContexts: AgentContext[];
  /**
   * Feature-level contexts keyed by a stable per-mount id. Populated via
   * `useAdvertiseAgentContext`; entries are cleared on unmount.
   */
  mountedContexts: Record<string, AgentContext>;
  setRouteContexts: (next: AgentContext[]) => void;
  setMountedContext: (key: string, context: AgentContext) => void;
  removeMountedContext: (key: string) => void;

  // -- Server-advertised, client-executed tool actions (ephemeral) --
  //
  // The server may advertise tools whose definitions are gated on resolved
  // context but whose implementations live in the browser (e.g. mutating a
  // page-local form). Mounted components register their handlers here keyed
  // by tool name; `handleAgentToolCall` looks up the entry when the matching
  // tool is invoked. Handlers must resolve to a discriminated result shape
  // so the dispatcher can map success/failure back to AI-SDK tool output.
  registeredClientActions: Record<string, AgentClientAction>;
  registerClientAction: (name: string, action: AgentClientAction) => void;
  unregisterClientAction: (name: string) => void;

  // -- Approval-gated tool proposals advertised by agent tool calls --
  // TODO(pending-tool-rehydration): Replace these tool-specific slices with a
  // generic pending tool state map keyed by toolCallId. The tool registry
  // should own each tool's serializer and runtime rebinder.
  pendingPromptEditsByToolCallId: Partial<Record<string, PendingPromptEdit>>;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
  pendingBatchSpanAnnotatesByToolCallId: Partial<
    Record<string, PendingBatchSpanAnnotate>
  >;
  setPendingBatchSpanAnnotate: (
    toolCallId: string,
    annotation: PendingBatchSpanAnnotate | null
  ) => void;
  pendingSavePromptsByToolCallId: Partial<Record<string, PendingSavePrompt>>;
  setPendingSavePrompt: (
    toolCallId: string,
    pendingSave: PendingSavePrompt | null
  ) => void;
}

/**
 * Handler for a server-advertised, client-executed agent tool. Receives the
 * raw `input` object the model produced (handlers are responsible for
 * validating shape) and resolves to a discriminated result the tool dispatch
 * surfaces back to the model as either tool output or a tool error.
 */
export type AgentClientActionResult =
  | { ok: true; output?: string }
  | { ok: false; error: string };

export type AgentClientAction = (
  input: unknown,
  context?: unknown
) => Promise<AgentClientActionResult>;

/**
 * Removes entries keyed by sessions that are no longer retained.
 */
function pruneSessionScopedRecord<T>({
  record,
  retainedSessionIds,
}: {
  record: Record<string, T>;
  retainedSessionIds: Set<string>;
}): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([sessionId]) =>
      retainedSessionIds.has(sessionId)
    )
  );
}

/**
 * Builds the persisted session-state patch after creating, pruning, or clearing
 * retained sessions, keeping sessionMap and related per-session UI state aligned.
 */
function buildSessionRetentionPatch({
  state,
  retainedSessionIds,
  activeSessionId,
}: {
  state: AgentState;
  retainedSessionIds: string[];
  activeSessionId: string | null;
}): Pick<
  AgentState,
  | "sessions"
  | "activeSessionId"
  | "sessionMap"
  | "pendingElicitationBySessionId"
  | "chatStatusBySessionId"
> {
  const retainedSessionIdSet = new Set(retainedSessionIds);
  return {
    sessions: retainedSessionIds,
    activeSessionId,
    sessionMap: pruneSessionScopedRecord({
      record: state.sessionMap,
      retainedSessionIds: retainedSessionIdSet,
    }),
    pendingElicitationBySessionId: pruneSessionScopedRecord({
      record: state.pendingElicitationBySessionId,
      retainedSessionIds: retainedSessionIdSet,
    }),
    chatStatusBySessionId: pruneSessionScopedRecord({
      record: state.chatStatusBySessionId,
      retainedSessionIds: retainedSessionIdSet,
    }),
  };
}

/**
 * Creates a Zustand store for managing agent UI state and conversation sessions.
 *
 * The store is wrapped with devtools (for Redux DevTools inspection) and
 * persist (to local storage under "arize-phoenix-assistant"). The `isOpen`
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
    position: "pinned",
    fabPlacement: "bottom-end",
    sessions: [],
    activeSessionId: null,
    sessionMap: {},
    defaultModelConfig: { ...DEFAULT_MODEL_CONFIG },
    agentsConfig: DEFAULT_AGENT_SERVER_CONFIG,
    observability: DEFAULT_AGENT_OBSERVABILITY_SETTINGS,
    permissions: DEFAULT_AGENT_PERMISSIONS,
    capabilities: createDefaultAgentCapabilities(),
    routeContexts: [],
    mountedContexts: {},
    pendingPromptEditsByToolCallId: {},
    pendingBatchSpanAnnotatesByToolCallId: {},
    pendingSavePromptsByToolCallId: {},
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
    setFabPlacement: (fabPlacement) => {
      set({ fabPlacement }, false, { type: "setFabPlacement" });
    },
    createSession: () => {
      const sessionId = generateUUID();
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
          let nextSessionIds: string[];
          if (state.capabilities["session.storeSessions"]) {
            nextSessionIds = [...state.sessions, sessionId].slice(
              -MAX_STORED_AGENT_SESSIONS
            );
          } else {
            nextSessionIds = [sessionId];
          }

          return {
            ...buildSessionRetentionPatch({
              state: {
                ...state,
                sessionMap: { ...state.sessionMap, [sessionId]: session },
              },
              retainedSessionIds: nextSessionIds,
              activeSessionId: sessionId,
            }),
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
    setObservability: (patch) => {
      set(
        (state) => ({
          observability: { ...state.observability, ...patch },
        }),
        false,
        { type: "setObservability" }
      );
    },
    setPermissions: (patch) => {
      set(
        (state) => ({
          permissions: { ...state.permissions, ...patch },
        }),
        false,
        { type: "setPermissions" }
      );
    },
    acknowledgeConsent: () => {
      set(
        (state) => ({
          observability: {
            ...state.observability,
            hasAcknowledgedConsent: true,
          },
        }),
        false,
        { type: "acknowledgeConsent" }
      );
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
    setCapability: ({ key, enabled }) => {
      set(
        (state) => {
          const capabilities = { ...state.capabilities, [key]: enabled };
          if (key !== "session.storeSessions" || enabled) {
            return { capabilities };
          }
          return {
            capabilities,
            ...buildSessionRetentionPatch({
              state,
              retainedSessionIds: state.activeSessionId
                ? [state.activeSessionId]
                : [],
              activeSessionId: state.activeSessionId,
            }),
          };
        },
        false,
        { type: "setCapability" }
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

    setSessionUsage: (sessionId, newUsage) => {
      set(
        (state) => {
          const session = state.sessionMap[sessionId];
          if (!session) return state;
          const usage: AgentSessionUsage = session.usage ?? {
            tokenCount: {
              total: 0,
              completion: 0,
              prompt: 0,
            },
          };
          return {
            sessionMap: {
              ...state.sessionMap,
              [sessionId]: {
                ...session,
                usage: {
                  ...usage,
                  tokenCount: {
                    prompt: newUsage.prompt,
                    completion: newUsage.completion,
                    total:
                      newUsage.total ?? newUsage.prompt + newUsage.completion,
                    ...(newUsage.promptDetails
                      ? { promptDetails: newUsage.promptDetails }
                      : {}),
                  } satisfies AgentSessionUsage["tokenCount"],
                },
              },
            },
          };
        },
        false,
        { type: "setSessionUsage" }
      );
    },

    // -- Page and mounted contexts (ephemeral) --
    setRouteContexts: (next) => {
      set(
        (state) => {
          if (state.routeContexts.length === next.length) {
            let same = true;
            for (let index = 0; index < next.length; index++) {
              if (
                agentContextKey(state.routeContexts[index]!) !==
                agentContextKey(next[index]!)
              ) {
                same = false;
                break;
              }
            }
            if (same) {
              return state;
            }
          }
          return { routeContexts: next };
        },
        false,
        { type: "setRouteContexts" }
      );
    },
    setMountedContext: (key, context) => {
      set(
        (state) => ({
          mountedContexts: { ...state.mountedContexts, [key]: context },
        }),
        false,
        { type: "setMountedContext" }
      );
    },
    removeMountedContext: (key) => {
      set(
        (state) => {
          if (!(key in state.mountedContexts)) {
            return state;
          }
          const next = { ...state.mountedContexts };
          delete next[key];
          return { mountedContexts: next };
        },
        false,
        { type: "removeMountedContext" }
      );
    },

    // -- Server-advertised, client-executed tool actions --
    registeredClientActions: {},
    registerClientAction: (name, action) => {
      set(
        (state) => ({
          registeredClientActions: {
            ...state.registeredClientActions,
            [name]: action,
          },
        }),
        false,
        { type: "registerClientAction" }
      );
    },
    unregisterClientAction: (name) => {
      set(
        (state) => {
          if (!(name in state.registeredClientActions)) {
            return state;
          }
          const next = { ...state.registeredClientActions };
          delete next[name];
          return { registeredClientActions: next };
        },
        false,
        { type: "unregisterClientAction" }
      );
    },

    setPendingPromptEdit: (toolCallId, edit) => {
      set(
        (state) => {
          const next = { ...state.pendingPromptEditsByToolCallId };
          if (edit) {
            next[toolCallId] = edit;
          } else {
            delete next[toolCallId];
          }
          return { pendingPromptEditsByToolCallId: next };
        },
        false,
        { type: "setPendingPromptEdit" }
      );
    },

    setPendingBatchSpanAnnotate: (toolCallId, annotation) => {
      set(
        (state) => {
          const next = { ...state.pendingBatchSpanAnnotatesByToolCallId };
          if (annotation) {
            next[toolCallId] = annotation;
          } else {
            delete next[toolCallId];
          }
          return { pendingBatchSpanAnnotatesByToolCallId: next };
        },
        false,
        { type: "setPendingBatchSpanAnnotate" }
      );
    },

    setPendingSavePrompt: (toolCallId, pendingSave) => {
      set(
        (state) => {
          const next = { ...state.pendingSavePromptsByToolCallId };
          if (pendingSave) {
            next[toolCallId] = pendingSave;
          } else {
            delete next[toolCallId];
          }
          return { pendingSavePromptsByToolCallId: next };
        },
        false,
        { type: "setPendingSavePrompt" }
      );
    },

    ...initialProps,
  });

  return create<AgentState>()(
    persist(devtools(agentStore, { name: "agentStore" }), {
      name: "arize-phoenix-assistant",
      version: 0,
      partialize: (state) => ({
        isOpen: state.isOpen,
        position: state.position,
        fabPlacement: state.fabPlacement,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        sessionMap: state.sessionMap,
        defaultModelConfig: state.defaultModelConfig,
        observability: state.observability,
        permissions: state.permissions,
        capabilities: state.capabilities,
      }),
    })
  );
};

export type AgentStore = ReturnType<typeof createAgentStore>;
