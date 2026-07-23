import type { ChatStatus } from "ai";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
  agentContextKey,
  type AgentContext,
} from "@phoenix/agent/context/agentContextTypes";
import {
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
  /**
   * Idle days after which persisted (non-temporary) sessions are deleted by
   * the workspace retention setting. Null means never.
   */
  sessionRetentionMaxIdleDays: number | null;
  /**
   * Maximum persisted (non-temporary) sessions kept per user by the workspace
   * retention setting; the newest by activity are retained. Null means no cap.
   */
  sessionRetentionMaxCountPerUser: number | null;
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
 * A message staged for a session whose chat view has not mounted yet, sent
 * automatically on mount. Carries the submit-time skill parse along with the
 * text so the request body matches what an interactive send would produce.
 */
export type PendingAgentMessage = {
  text: string;
  requestedSkills: string[];
};

/**
 * Sentinel session key for the not-yet-persisted "new chat" draft surface.
 *
 * Sessions are otherwise identified by their canonical Relay node ID. The
 * draft has no server-side session until the user sends their first message,
 * at which point the UI creates a session imperatively and re-keys the
 * surface to the returned ID. Ephemeral per-session state (draft input,
 * pending message) for the draft surface is keyed by this constant.
 */
export const DRAFT_SESSION_ID = "pxi:draft-session";

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
  sessionRetentionMaxIdleDays: null,
  sessionRetentionMaxCountPerUser: null,
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
 * Serializable properties that define the agent's state. UI preferences are
 * persisted to local storage; session state is not — sessions live in the
 * server's database and are hydrated per app load.
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
  /**
   * Relay node ID of the currently active session, {@link DRAFT_SESSION_ID}
   * for the not-yet-persisted new-chat draft, or null when nothing has been
   * selected yet (e.g. before the panel picks a session on first open).
   */
  activeSessionId: string | null;
  /** Whether the not-yet-persisted draft will become a temporary session. */
  isDraftSessionTemporary: boolean;
  /**
   * User preference for whether new chats start in temporary mode. Seeds
   * {@link isDraftSessionTemporary} whenever a fresh draft begins (app load,
   * starting a new chat, or after the draft's first message is sent).
   * Persisted; defaults to false.
   */
  defaultTemporaryChat: boolean;
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
  setActiveSession: (sessionId: string | null) => void;
  setIsDraftSessionTemporary: (isTemporary: boolean) => void;
  setDefaultTemporaryChat: (defaultTemporaryChat: boolean) => void;
  /**
   * Drops all ephemeral per-session state (chat status, draft input, pending
   * message, elicitation, tool proposals) for a deleted or re-keyed session.
   * Session identity and transcripts live in Relay, not here.
   */
  clearSessionEphemeralState: (sessionId: string) => void;
  setDefaultModelConfig: (config: ModelConfig) => void;
  setObservability: (patch: Partial<AgentObservabilitySettings>) => void;
  setPermissions: (patch: Partial<AgentPermissions>) => void;
  setAgentsConfig: (
    patch: Partial<
      Pick<
        AgentServerConfig,
        | "assistantEnabled"
        | "allowLocalTraces"
        | "allowRemoteExport"
        | "sessionRetentionMaxIdleDays"
        | "sessionRetentionMaxCountPerUser"
      >
    >
  ) => void;
  acknowledgeConsent: () => void;
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
  /** Whether a manual context compaction is in progress for a session. */
  isCompactionPendingBySessionId: Partial<Record<string, boolean>>;
  setSessionCompactionPending: (sessionId: string, isPending: boolean) => void;

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
  return Object.fromEntries(
    (Object.keys(defaultCapabilities) as AgentCapabilityKey[]).map((key) => {
      const persistedValue = persistedCapabilities[key];
      return [
        key,
        typeof persistedValue === "boolean"
          ? persistedValue
          : defaultCapabilities[key],
      ];
    })
  ) as AgentCapabilities;
}

function mergeAgentPersistedState(
  persistedState: unknown,
  currentState: AgentState
): AgentState {
  if (!persistedState || typeof persistedState !== "object") {
    return currentState;
  }
  const {
    // Blobs written before sessions moved to server-side persistence still
    // carry session state in localStorage; never rehydrate it.
    sessions: _sessions,
    activeSessionId: _activeSessionId,
    sessionMap: _sessionMap,
    ...persisted
  } = persistedState as Partial<AgentState> & {
    sessions?: unknown;
    sessionMap?: unknown;
  };
  const defaultTemporaryChat =
    typeof persisted.defaultTemporaryChat === "boolean"
      ? persisted.defaultTemporaryChat
      : currentState.defaultTemporaryChat;
  return {
    ...currentState,
    ...persisted,
    defaultTemporaryChat,
    isDraftSessionTemporary: defaultTemporaryChat,
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

function removeToolCallRecordForSession<T extends { sessionId: string }>(
  record: Partial<Record<string, T>>,
  sessionId: string
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value?.sessionId !== sessionId)
  );
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
    activeSessionId: null,
    isDraftSessionTemporary: false,
    defaultTemporaryChat: false,
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
    setActiveSession: (sessionId) => {
      set({ activeSessionId: sessionId }, false, { type: "setActiveSession" });
    },
    setIsDraftSessionTemporary: (isDraftSessionTemporary) => {
      set({ isDraftSessionTemporary }, false, {
        type: "setIsDraftSessionTemporary",
      });
    },
    setDefaultTemporaryChat: (defaultTemporaryChat) => {
      set({ defaultTemporaryChat }, false, {
        type: "setDefaultTemporaryChat",
      });
    },
    clearSessionEphemeralState: (sessionId) => {
      set(
        (state) => {
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
          const newIsCompactionPendingBySessionId = {
            ...state.isCompactionPendingBySessionId,
          };
          delete newIsCompactionPendingBySessionId[sessionId];
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
          return {
            pendingElicitationBySessionId: newPendingElicitationBySessionId,
            chatStatusBySessionId: newChatStatusBySessionId,
            isResponsePendingBySessionId: newIsResponsePendingBySessionId,
            isCompactionPendingBySessionId: newIsCompactionPendingBySessionId,
            draftInputBySessionId: newDraftInputBySessionId,
            pendingMessageBySessionId: newPendingMessageBySessionId,
            pendingPatchExperimentsByToolCallId:
              newPendingPatchExperimentsByToolCallId,
          };
        },
        false,
        { type: "clearSessionEphemeralState" }
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
    setCapability: ({ key, enabled }) => {
      set(
        (state) => ({
          capabilities: { ...state.capabilities, [key]: enabled },
        }),
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
    isCompactionPendingBySessionId: {},
    setSessionCompactionPending: (sessionId, isPending) => {
      set(
        (state) => {
          const next = { ...state.isCompactionPendingBySessionId };
          if (isPending) {
            next[sessionId] = true;
          } else {
            delete next[sessionId];
          }
          return { isCompactionPendingBySessionId: next };
        },
        false,
        { type: "setSessionCompactionPending" }
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
      // Sessions are deliberately absent: they persist only in the server's
      // database and are hydrated over the network on each app load.
      partialize: (state) => ({
        isOpen: state.isOpen,
        position: state.position,
        fabMode: state.fabMode,
        fabPlacement: state.fabPlacement,
        defaultTemporaryChat: state.defaultTemporaryChat,
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
