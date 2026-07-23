import { isTextUIPart, type ChatStatus } from "ai";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import {
  agentContextKey,
  type AgentContext,
} from "@phoenix/agent/context/agentContextTypes";
import {
  AGENT_CAPABILITY_DEFINITIONS,
  createDefaultAgentCapabilities,
  type AgentCapabilities,
  type AgentCapabilityKey,
} from "@phoenix/agent/extensions/capabilities";
import type { PendingDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";
import type { PendingAnnotationConfigWrite } from "@phoenix/agent/tools/annotationConfig";
import type { PendingBatchSpanAnnotate } from "@phoenix/agent/tools/batchSpanAnnotate";
import type { PendingCodeEvaluatorEdit } from "@phoenix/agent/tools/codeEvaluatorDraft";
import type { PendingElicitation } from "@phoenix/agent/tools/elicit";
import type { PendingLlmEvaluatorEdit } from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { PendingPatchExperiment } from "@phoenix/agent/tools/patchExperiment";
import type { PendingLoadDataset } from "@phoenix/agent/tools/playgroundLoadDataset";
import type {
  PendingPromptEdit,
  PendingPromptInstanceRemoval,
} from "@phoenix/agent/tools/playgroundPrompt";
import type { PendingPromptToolWrite } from "@phoenix/agent/tools/playgroundPromptTools";
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

/**
 * How the PXI assistant button is presented.
 * - "pinned": rendered inline at the right edge of the top nav
 * - "floating": a draggable floating action button snapped to a viewport
 *   corner (see {@link AgentFabPlacement})
 */
export type AgentFabMode = "pinned" | "floating";

/** Server-provided PXI configuration exposed to the frontend. */
export type AgentServerConfig = {
  /** Remote collector used for optional agent trace export. */
  collectorEndpoint: string | null;
  /** Local Phoenix project used for PXI trace persistence. */
  assistantProjectName: string;
  /** Whether tracing and remote export are forced by the Phoenix instance. */
  forceTracing: boolean;
  /** Whether this Phoenix instance allows PXI web search/fetch. */
  webAccessEnabled: boolean;
  assistantEnabled: boolean;
  allowLocalTraces: boolean;
  allowRemoteExport: boolean;
};

export type AgentTraceConsentSettings = Pick<
  AgentServerConfig,
  "allowLocalTraces" | "allowRemoteExport"
>;

export type AgentTraceRecordingSettings = {
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
};

export type AgentObservabilitySettings = {
  /** Whether PXI traces should be persisted in the current Phoenix instance. */
  storeLocalTraces: boolean;
  /** Whether PXI traces should also be exported to a remote collector. */
  exportRemoteTraces: boolean;
  /**
   * Whether the authenticated Phoenix user's email should be attached to PXI
   * traces as the OpenInference `user.id` attribute. Defaults to false so
   * user attribution is opt-in. The backend only honours this flag for
   * authenticated PhoenixUser requests — the browser cannot supply an
   * arbitrary user value.
   */
  attachUserId: boolean;
  acknowledgedTraceConsent: AgentTraceConsentSettings | null;
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
 * A message staged for a session whose chat view has not mounted yet, sent
 * automatically on mount. Carries the submit-time skill parse along with the
 * text so the request body matches what an interactive send would produce.
 */
export type PendingAgentMessage = {
  text: string;
  requestedSkills: string[];
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
  forceTracing: false,
  webAccessEnabled: false,
  assistantEnabled: false,
  allowLocalTraces: false,
  allowRemoteExport: false,
};

const DEFAULT_AGENT_OBSERVABILITY_SETTINGS: AgentObservabilitySettings = {
  storeLocalTraces: true,
  exportRemoteTraces: false,
  attachUserId: false,
  acknowledgedTraceConsent: null,
};

const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  edits: "manual",
};

const MAX_STORED_AGENT_SESSIONS = 3;

/** Prefix applied to a branched session's summary to denote its origin. */
const FORK_SUMMARY_PREFIX = "(branch) ";

/** Max length for a derived (non-LLM) fork summary before truncation. */
const FORK_SUMMARY_MAX_LENGTH = 50;

/**
 * Builds the summary for a session branched from `source`. Reuses the source's
 * LLM-generated summary when available, otherwise derives a short label from
 * its first user message, then prefixes it with `(branch)`. Seeding a non-empty
 * summary here also prevents the async summarizer from overwriting it.
 */
function buildForkSummary(source: AgentSession): string {
  let base = source.shortSummary.trim();
  if (!base) {
    const firstUserMessage = source.messages.find(
      (message) => message.role === "user"
    );
    const text = firstUserMessage?.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join(" ")
      .trim();
    base = text
      ? text.length > FORK_SUMMARY_MAX_LENGTH
        ? `${text.slice(0, FORK_SUMMARY_MAX_LENGTH)}...`
        : text
      : "";
  }
  // Avoid stacking "(branch) (branch) ..." when branching from a branch.
  if (base.startsWith(FORK_SUMMARY_PREFIX)) {
    return base;
  }
  return base ? `${FORK_SUMMARY_PREFIX}${base}` : FORK_SUMMARY_PREFIX.trim();
}

export function getCurrentTraceConsentSettings(
  agentsConfig: AgentServerConfig
): AgentTraceConsentSettings {
  return {
    allowLocalTraces: agentsConfig.allowLocalTraces,
    allowRemoteExport:
      Boolean(agentsConfig.collectorEndpoint) && agentsConfig.allowRemoteExport,
  };
}

export function hasAcknowledgedCurrentTraceConsent({
  agentsConfig,
  observability,
}: {
  agentsConfig: AgentServerConfig;
  observability: AgentObservabilitySettings;
}): boolean {
  if (agentsConfig.forceTracing) {
    return true;
  }
  const acknowledgedTraceConsent = observability.acknowledgedTraceConsent;
  if (!acknowledgedTraceConsent) {
    return false;
  }
  const currentTraceConsent = getCurrentTraceConsentSettings(agentsConfig);
  return (
    (!currentTraceConsent.allowLocalTraces ||
      acknowledgedTraceConsent.allowLocalTraces) &&
    (!currentTraceConsent.allowRemoteExport ||
      acknowledgedTraceConsent.allowRemoteExport)
  );
}

export function getEffectiveTraceRecordingSettings({
  agentsConfig,
  observability,
}: {
  agentsConfig: AgentServerConfig;
  observability: AgentObservabilitySettings;
}): AgentTraceRecordingSettings {
  if (agentsConfig.forceTracing) {
    return {
      ingestTraces: true,
      exportRemoteTraces: true,
    };
  }
  const ceiling = getCurrentTraceConsentSettings(agentsConfig);
  return {
    ingestTraces: ceiling.allowLocalTraces && observability.storeLocalTraces,
    exportRemoteTraces:
      ceiling.allowRemoteExport && observability.exportRemoteTraces,
  };
}

export function getEffectiveAttachUserId({
  agentsConfig,
  observability,
}: {
  agentsConfig: AgentServerConfig;
  observability: AgentObservabilitySettings;
}): boolean {
  return agentsConfig.forceTracing || observability.attachUserId;
}

/**
 * Serializable properties that define the agent's state.
 * These are the values persisted to local storage.
 */
export interface AgentProps {
  /** Whether the agent panel is currently visible. */
  isOpen: boolean;
  /** Current layout position of the agent panel. */
  position: AgentPosition;
  /** Whether the assistant button is pinned to the top nav or floating. */
  fabMode: AgentFabMode;
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
  setFabMode: (mode: AgentFabMode) => void;
  setFabPlacement: (placement: AgentFabPlacement) => void;
  createSession: () => string;
  deleteSession: (sessionId: string) => void;
  forkSession: (params: {
    sourceSessionId: string;
    messages: AgentUIMessage[];
    restoredInput?: string | null;
  }) => string | null;
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
  setAgentsConfig: (
    patch: Partial<
      Pick<
        AgentServerConfig,
        "assistantEnabled" | "allowLocalTraces" | "allowRemoteExport"
      >
    >
  ) => void;
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
  /** Whether a logical PXI turn is still awaiting its terminal response. */
  isResponsePendingBySessionId: Partial<Record<string, boolean>>;
  setSessionResponsePending: (sessionId: string, isPending: boolean) => void;

  /**
   * Current unsent prompt-input draft keyed by session ID. Ephemeral and kept
   * out of local-storage persistence, but survives remounts while the app is
   * alive so moving the panel between docked and floating layouts does not
   * clear the composer.
   */
  draftInputBySessionId: Record<string, string>;
  setDraftInput: (sessionId: string, input: string | null) => void;

  /**
   * A message staged to be sent as soon as a session's chat view mounts. Used
   * by local prompt commands (e.g. `/clear fix this`): the command creates a
   * fresh session, and the rest of the submitted message is carried over and
   * sent there. A consumed pending message is sent immediately rather than
   * placed in the textarea. Ephemeral and consumed once by the view on mount.
   */
  pendingMessageBySessionId: Record<string, PendingAgentMessage>;
  setPendingMessage: (
    sessionId: string,
    message: PendingAgentMessage | null
  ) => void;
  consumePendingMessage: (sessionId: string) => PendingAgentMessage | null;
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
  pendingPromptInstanceRemovalsByToolCallId: Partial<
    Record<string, PendingPromptInstanceRemoval>
  >;
  setPendingPromptInstanceRemoval: (
    toolCallId: string,
    removal: PendingPromptInstanceRemoval | null
  ) => void;
  pendingBatchSpanAnnotatesByToolCallId: Partial<
    Record<string, PendingBatchSpanAnnotate>
  >;
  setPendingBatchSpanAnnotate: (
    toolCallId: string,
    annotation: PendingBatchSpanAnnotate | null
  ) => void;
  pendingDatasetWritesByToolCallId: Partial<
    Record<string, PendingDatasetWrite>
  >;
  setPendingDatasetWrite: (
    toolCallId: string,
    pending: PendingDatasetWrite | null
  ) => void;
  pendingAnnotationConfigWritesByToolCallId: Partial<
    Record<string, PendingAnnotationConfigWrite>
  >;
  setPendingAnnotationConfigWrite: (
    toolCallId: string,
    pending: PendingAnnotationConfigWrite | null
  ) => void;
  pendingPatchExperimentsByToolCallId: Partial<
    Record<string, PendingPatchExperiment>
  >;
  setPendingPatchExperiment: (
    toolCallId: string,
    patch: PendingPatchExperiment | null
  ) => void;
  pendingPromptToolWritesByToolCallId: Partial<
    Record<string, PendingPromptToolWrite>
  >;
  setPendingPromptToolWrite: (
    toolCallId: string,
    write: PendingPromptToolWrite | null
  ) => void;
  pendingSavePromptsByToolCallId: Partial<Record<string, PendingSavePrompt>>;
  setPendingSavePrompt: (
    toolCallId: string,
    pendingSave: PendingSavePrompt | null
  ) => void;

  // -- Code-evaluator draft edit approvals advertised by edit_code_evaluator_draft tool calls --
  pendingCodeEvaluatorEditsByToolCallId: Partial<
    Record<string, PendingCodeEvaluatorEdit>
  >;
  setPendingCodeEvaluatorEdit: (
    toolCallId: string,
    edit: PendingCodeEvaluatorEdit | null
  ) => void;

  // -- LLM-evaluator draft edit approvals advertised by edit_llm_evaluator_draft tool calls --
  pendingLlmEvaluatorEditsByToolCallId: Partial<
    Record<string, PendingLlmEvaluatorEdit>
  >;
  setPendingLlmEvaluatorEdit: (
    toolCallId: string,
    edit: PendingLlmEvaluatorEdit | null
  ) => void;
  pendingLoadDatasetsByToolCallId: Partial<Record<string, PendingLoadDataset>>;
  setPendingLoadDataset: (
    toolCallId: string,
    pendingLoad: PendingLoadDataset | null
  ) => void;
}

function normalizeAgentCapabilities({
  capabilities,
  defaultCapabilities = createDefaultAgentCapabilities(),
}: {
  capabilities: unknown;
  defaultCapabilities?: AgentCapabilities;
}): AgentCapabilities {
  if (!capabilities || typeof capabilities !== "object") {
    return { ...defaultCapabilities };
  }
  const persistedCapabilities = capabilities as Partial<
    Record<AgentCapabilityKey, unknown>
  >;
  const normalized: AgentCapabilities = { ...defaultCapabilities };
  for (const { key } of AGENT_CAPABILITY_DEFINITIONS) {
    const persistedValue = persistedCapabilities[key];
    if (typeof persistedValue === "boolean") {
      normalized[key] = persistedValue;
    }
  }
  return normalized;
}

function mergeAgentPersistedState(
  persistedState: unknown,
  currentState: AgentState
): AgentState {
  if (!persistedState || typeof persistedState !== "object") {
    return currentState;
  }
  const persisted = persistedState as Partial<AgentState>;
  return {
    ...currentState,
    ...persisted,
    observability: {
      ...currentState.observability,
      ...persisted.observability,
    },
    capabilities: normalizeAgentCapabilities({
      capabilities: persisted.capabilities,
      defaultCapabilities: currentState.capabilities,
    }),
  };
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

function pruneToolCallRecordBySession<T extends { sessionId: string }>({
  record,
  retainedSessionIds,
}: {
  record: Partial<Record<string, T>>;
  retainedSessionIds: Set<string>;
}): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value != null && retainedSessionIds.has(value.sessionId)
    )
  );
}

function removeToolCallRecordForSession<T extends { sessionId: string }>(
  record: Partial<Record<string, T>>,
  sessionId: string
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value?.sessionId !== sessionId)
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
  | "isResponsePendingBySessionId"
  | "draftInputBySessionId"
  | "pendingMessageBySessionId"
  | "pendingPatchExperimentsByToolCallId"
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
    isResponsePendingBySessionId: pruneSessionScopedRecord({
      record: state.isResponsePendingBySessionId,
      retainedSessionIds: retainedSessionIdSet,
    }),
    draftInputBySessionId: pruneSessionScopedRecord({
      record: state.draftInputBySessionId,
      retainedSessionIds: retainedSessionIdSet,
    }),
    pendingMessageBySessionId: pruneSessionScopedRecord({
      record: state.pendingMessageBySessionId,
      retainedSessionIds: retainedSessionIdSet,
    }),
    pendingPatchExperimentsByToolCallId: pruneToolCallRecordBySession({
      record: state.pendingPatchExperimentsByToolCallId,
      retainedSessionIds: retainedSessionIdSet,
    }),
  };
}

/**
 * Base local-storage key for the persisted assistant state. Used verbatim for
 * single-tenant deployments and as a prefix when scoping by root path.
 */
const BASE_ASSISTANT_STORAGE_KEY = "arize-phoenix-assistant";

/**
 * Resolves the local-storage key for the persisted assistant state, scoped to
 * the deployment's root path.
 *
 * `localStorage` is origin-scoped and path-blind. In multi-tenant deployments
 * (e.g. Phoenix Cloud) many workspaces are served from distinct root paths on
 * the SAME browser origin, so a single shared key would let one workspace's
 * chat history load in another. Scoping by the root-path basename aligns this
 * with the per-deployment isolation boundary already enforced server-side by
 * PHOENIX_COOKIES_PATH (which is set to the same root path).
 *
 * Deployments without a root path (the common single-tenant case, e.g. OSS)
 * use the base key unchanged so existing history is preserved on upgrade.
 * Under a root path the new scoped key simply leaves the old unscoped blob
 * untouched; nothing reads it once the key changes.
 */
export function resolveAssistantStorageKey(): string {
  const basename = (window.Config?.basename ?? "").replace(/\/+$/, "");
  return basename
    ? `${BASE_ASSISTANT_STORAGE_KEY}:${basename}`
    : BASE_ASSISTANT_STORAGE_KEY;
}

/**
 * Creates a Zustand store for managing agent UI state and conversation sessions.
 *
 * The store is wrapped with devtools (for Redux DevTools inspection) and
 * persist (to local storage under a per-deployment key derived from the root
 * path; see {@link resolveAssistantStorageKey}). The `isOpen` property is
 * excluded from persistence so the panel always starts closed.
 *
 * @param initialProps - Optional overrides for the default store properties.
 */
export const createAgentStore = (initialProps?: Partial<AgentProps>) => {
  const agentStore: StateCreator<
    AgentState,
    [["zustand/devtools", unknown]]
  > = (set, get) => ({
    isOpen: false,
    position: "pinned",
    fabMode: "pinned",
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
    pendingPromptInstanceRemovalsByToolCallId: {},
    pendingBatchSpanAnnotatesByToolCallId: {},
    pendingDatasetWritesByToolCallId: {},
    pendingAnnotationConfigWritesByToolCallId: {},
    pendingPatchExperimentsByToolCallId: {},
    pendingPromptToolWritesByToolCallId: {},
    pendingSavePromptsByToolCallId: {},
    pendingCodeEvaluatorEditsByToolCallId: {},
    pendingLlmEvaluatorEditsByToolCallId: {},
    pendingLoadDatasetsByToolCallId: {},
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
    setFabMode: (fabMode) => {
      set({ fabMode }, false, { type: "setFabMode" });
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
    forkSession: ({ sourceSessionId, messages, restoredInput }) => {
      const sessionId = generateUUID();
      let created = false;
      set(
        (state) => {
          const source = state.sessionMap[sourceSessionId];
          if (!source) return state;
          created = true;
          const session: AgentSession = {
            id: sessionId,
            shortSummary: buildForkSummary(source),
            messages,
            // Carry over the source session's context and model so the fork
            // continues the same conversation under the same configuration.
            context: [...source.context],
            modelConfig: { ...source.modelConfig },
            createdAt: Date.now(),
          };
          // Forking always retains the source session alongside the new one;
          // the standard retention rule then trims to the most recent few.
          const nextSessionIds = [...state.sessions, sessionId].slice(
            -MAX_STORED_AGENT_SESSIONS
          );
          const draftInputBySessionId = restoredInput
            ? { ...state.draftInputBySessionId, [sessionId]: restoredInput }
            : state.draftInputBySessionId;
          return {
            ...buildSessionRetentionPatch({
              state: {
                ...state,
                sessionMap: { ...state.sessionMap, [sessionId]: session },
                draftInputBySessionId,
              },
              retainedSessionIds: nextSessionIds,
              activeSessionId: sessionId,
            }),
          };
        },
        false,
        { type: "forkSession" }
      );
      return created ? sessionId : null;
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
          const newIsResponsePendingBySessionId = {
            ...state.isResponsePendingBySessionId,
          };
          delete newIsResponsePendingBySessionId[sessionId];
          const newDraftInputBySessionId = { ...state.draftInputBySessionId };
          delete newDraftInputBySessionId[sessionId];
          const newPendingMessageBySessionId = {
            ...state.pendingMessageBySessionId,
          };
          delete newPendingMessageBySessionId[sessionId];
          const newPendingPatchExperimentsByToolCallId =
            removeToolCallRecordForSession(
              state.pendingPatchExperimentsByToolCallId,
              sessionId
            );
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
            isResponsePendingBySessionId: newIsResponsePendingBySessionId,
            draftInputBySessionId: newDraftInputBySessionId,
            pendingMessageBySessionId: newPendingMessageBySessionId,
            pendingPatchExperimentsByToolCallId:
              newPendingPatchExperimentsByToolCallId,
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
    setAgentsConfig: (patch) => {
      set(
        (state) => ({
          agentsConfig: { ...state.agentsConfig, ...patch },
        }),
        false,
        { type: "setAgentsConfig" }
      );
    },
    acknowledgeConsent: () => {
      set(
        (state) => ({
          observability: {
            ...state.observability,
            acknowledgedTraceConsent: getCurrentTraceConsentSettings(
              state.agentsConfig
            ),
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
          isResponsePendingBySessionId: {},
          draftInputBySessionId: {},
          pendingMessageBySessionId: {},
          pendingPatchExperimentsByToolCallId: {},
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

    draftInputBySessionId: {},
    setDraftInput: (sessionId, input) => {
      set(
        (state) => {
          const next = { ...state.draftInputBySessionId };
          if (input) {
            next[sessionId] = input;
          } else {
            delete next[sessionId];
          }
          return { draftInputBySessionId: next };
        },
        false,
        { type: "setDraftInput" }
      );
    },

    pendingMessageBySessionId: {},
    setPendingMessage: (sessionId, message) => {
      set(
        (state) => {
          const next = { ...state.pendingMessageBySessionId };
          if (message) {
            next[sessionId] = message;
          } else {
            delete next[sessionId];
          }
          return { pendingMessageBySessionId: next };
        },
        false,
        { type: "setPendingMessage" }
      );
    },
    consumePendingMessage: (sessionId) => {
      const message = get().pendingMessageBySessionId[sessionId] ?? null;
      if (message != null) {
        set(
          (state) => {
            if (!(sessionId in state.pendingMessageBySessionId)) {
              return state;
            }
            const next = { ...state.pendingMessageBySessionId };
            delete next[sessionId];
            return { pendingMessageBySessionId: next };
          },
          false,
          { type: "consumePendingMessage" }
        );
      }
      return message;
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
    isResponsePendingBySessionId: {},
    setSessionResponsePending: (sessionId, isPending) => {
      set(
        (state) => {
          if (!(sessionId in state.sessionMap)) {
            return state;
          }
          const next = { ...state.isResponsePendingBySessionId };
          if (isPending) {
            next[sessionId] = true;
          } else {
            delete next[sessionId];
          }
          return { isResponsePendingBySessionId: next };
        },
        false,
        { type: "setSessionResponsePending" }
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

    setPendingPromptInstanceRemoval: (toolCallId, removal) => {
      set(
        (state) => {
          const next = { ...state.pendingPromptInstanceRemovalsByToolCallId };
          if (removal) {
            next[toolCallId] = removal;
          } else {
            delete next[toolCallId];
          }
          return { pendingPromptInstanceRemovalsByToolCallId: next };
        },
        false,
        { type: "setPendingPromptInstanceRemoval" }
      );
    },

    setPendingDatasetWrite: (toolCallId, pending) => {
      set(
        (state) => {
          const next = { ...state.pendingDatasetWritesByToolCallId };
          if (pending) {
            next[toolCallId] = pending;
          } else {
            delete next[toolCallId];
          }
          return { pendingDatasetWritesByToolCallId: next };
        },
        false,
        { type: "setPendingDatasetWrite" }
      );
    },
    setPendingAnnotationConfigWrite: (toolCallId, pending) => {
      set(
        (state) => {
          const next = { ...state.pendingAnnotationConfigWritesByToolCallId };
          if (pending) {
            next[toolCallId] = pending;
          } else {
            delete next[toolCallId];
          }
          return { pendingAnnotationConfigWritesByToolCallId: next };
        },
        false,
        { type: "setPendingAnnotationConfigWrite" }
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

    setPendingPatchExperiment: (toolCallId, patch) => {
      set(
        (state) => {
          const next = { ...state.pendingPatchExperimentsByToolCallId };
          if (patch) {
            next[toolCallId] = patch;
          } else {
            delete next[toolCallId];
          }
          return { pendingPatchExperimentsByToolCallId: next };
        },
        false,
        { type: "setPendingPatchExperiment" }
      );
    },

    setPendingPromptToolWrite: (toolCallId, write) => {
      set(
        (state) => {
          const next = { ...state.pendingPromptToolWritesByToolCallId };
          if (write) {
            next[toolCallId] = write;
          } else {
            delete next[toolCallId];
          }
          return { pendingPromptToolWritesByToolCallId: next };
        },
        false,
        { type: "setPendingPromptToolWrite" }
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

    setPendingCodeEvaluatorEdit: (toolCallId, edit) => {
      set(
        (state) => {
          const next = { ...state.pendingCodeEvaluatorEditsByToolCallId };
          if (edit) {
            next[toolCallId] = edit;
          } else {
            delete next[toolCallId];
          }
          return { pendingCodeEvaluatorEditsByToolCallId: next };
        },
        false,
        { type: "setPendingCodeEvaluatorEdit" }
      );
    },

    setPendingLlmEvaluatorEdit: (toolCallId, edit) => {
      set(
        (state) => {
          const next = { ...state.pendingLlmEvaluatorEditsByToolCallId };
          if (edit) {
            next[toolCallId] = edit;
          } else {
            delete next[toolCallId];
          }
          return { pendingLlmEvaluatorEditsByToolCallId: next };
        },
        false,
        { type: "setPendingLlmEvaluatorEdit" }
      );
    },
    setPendingLoadDataset: (toolCallId, pendingLoad) => {
      set(
        (state) => {
          const next = { ...state.pendingLoadDatasetsByToolCallId };
          if (pendingLoad) {
            next[toolCallId] = pendingLoad;
          } else {
            delete next[toolCallId];
          }
          return { pendingLoadDatasetsByToolCallId: next };
        },
        false,
        { type: "setPendingLoadDataset" }
      );
    },

    ...initialProps,
  });

  return create<AgentState>()(
    persist(devtools(agentStore, { name: "agentStore" }), {
      name: resolveAssistantStorageKey(),
      version: 0,
      partialize: (state) => ({
        isOpen: state.isOpen,
        position: state.position,
        fabMode: state.fabMode,
        fabPlacement: state.fabPlacement,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        sessionMap: state.sessionMap,
        defaultModelConfig: state.defaultModelConfig,
        observability: state.observability,
        permissions: state.permissions,
        capabilities: state.capabilities,
      }),
      merge: mergeAgentPersistedState,
    })
  );
};

export type AgentStore = ReturnType<typeof createAgentStore>;

export async function waitForRegisteredClientActions({
  agentStore,
  names,
  timeoutMs = 5000,
}: {
  agentStore: AgentStore;
  names: readonly string[];
  timeoutMs?: number;
}): Promise<boolean> {
  const hasAllActions = (
    registeredClientActions: Record<string, AgentClientAction>
  ) => names.every((name) => name in registeredClientActions);

  if (hasAllActions(agentStore.getState().registeredClientActions)) {
    return true;
  }

  return new Promise((resolve) => {
    let isSettled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const settle = (isReady: boolean) => {
      if (isSettled) return;
      isSettled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
      resolve(isReady);
    };

    const unsubscribe = agentStore.subscribe((state) => {
      if (hasAllActions(state.registeredClientActions)) {
        settle(true);
      }
    });

    timeoutId = setTimeout(() => settle(false), timeoutMs);

    if (hasAllActions(agentStore.getState().registeredClientActions)) {
      settle(true);
    }
  });
}
