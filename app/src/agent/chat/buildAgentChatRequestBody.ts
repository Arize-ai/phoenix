import { isToolUIPart } from "ai";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { components } from "@phoenix/api/__generated__/v1";
import {
  getEffectiveAttachUserId,
  getEffectiveTraceRecordingSettings,
  type AgentObservabilitySettings,
  type AgentPermissions,
  type AgentServerConfig,
} from "@phoenix/store/agentStore";

import type { ClientToolTimingRecorder } from "./clientToolTimings";
import { toServerSafeUIMessages } from "./serverSafeMessages";
import type { TurnTraceContext } from "./turnTraceContext";
import type { AgentUIMessage } from "./types";

export type AgentModelSelection = components["schemas"]["ChatRequest"]["model"];

type BuildAgentChatRequestBodyOptions = {
  /** Existing request body from the AI SDK transport, if any. */
  body: Partial<BuildAgentChatRequestBodyResult> | undefined;
  /** Chat identifier used by the transport for this conversation. */
  id: string;
  /**
   * Full UI message history from the transport. The server owns the session
   * transcript, so only the trailing message is sent: the turn's new user
   * message, or the trailing assistant message updated with client-executed
   * tool results.
   */
  messages: AgentUIMessage[];
  /** Runtime capability snapshot to expose to the model for this turn. */
  capabilities: AgentCapabilities;
  /** Per-user PXI observability settings for this request. */
  observability: AgentObservabilitySettings;
  agentsConfig: AgentServerConfig;
  /** Per-user PXI approval permission settings for this request. */
  permissions: AgentPermissions;
  /** Typed page and mounted UI contexts for the current turn. */
  contexts: AgentContext[];
  /** Provider + model selection for this turn. */
  modelSelection: AgentModelSelection;
  /** Server-minted identity echoed on continuation requests. */
  turnTraceContext?: TurnTraceContext | null;
  /** Persisted transcript revision used for optimistic concurrency control. */
  expectedRevision?: number;
  /** Browser execution timings added to completed client-tool parts. */
  toolTimings?: ClientToolTimingRecorder | null;
};

type BuildAgentChatRequestBodyResult = components["schemas"]["ChatRequest"];

/**
 * Browser-recorded execution timings added to the `phoenix` namespace of
 * `callProviderMetadata` on resolved client-tool parts. Picked from the
 * generated wire contract so a server-side rename fails compilation here.
 */
type ClientToolTimingMetadata = Pick<
  components["schemas"]["ToolCallCallbackProviderMetadata"],
  "clientStartedAt" | "clientEndedAt"
>;

export type AgentChatRequestBodyPatch = Pick<
  BuildAgentChatRequestBodyResult,
  "requestedSkills"
>;

/**
 * Build GraphQL context from the current capability snapshot.
 *
 * Forwards the user's mutations toggle to the backend as a typed context so
 * the agent's server-side instructions can render the matching guidance.
 */
function buildGraphQLContext(capabilities: AgentCapabilities): AgentContext {
  return {
    type: "graphql",
    mutationsEnabled: capabilities["graphql.mutations"] ?? false,
  };
}

/**
 * Build web access context from the current capability snapshot.
 *
 * Forwards the user's web access toggle to the backend as a typed context.
 */
function buildWebAccessContext(capabilities: AgentCapabilities): AgentContext {
  return {
    type: "web_access",
    enabled: capabilities["web.access"] ?? false,
  };
}

/**
 * Build subagents context from the current capability snapshot.
 */
function buildSubagentsContext(capabilities: AgentCapabilities): AgentContext {
  return {
    type: "subagents",
    enabled: capabilities["subagents.enabled"] ?? false,
  };
}

/**
 * Merges the AI SDK transport payload with PXI chat metadata. Tool definitions
 * are intentionally omitted because the server is the model-facing authority,
 * and the message history is reduced to the turn's trailing message because
 * the server is authoritative for the session transcript.
 */
export function buildAgentChatRequestBody({
  body,
  id,
  messages,
  capabilities,
  observability,
  agentsConfig,
  permissions,
  contexts,
  modelSelection,
  turnTraceContext = null,
  expectedRevision = 0,
  toolTimings = null,
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  const traceRecording = getEffectiveTraceRecordingSettings({
    agentsConfig,
    observability,
  });
  const requestContexts = [
    buildGraphQLContext(capabilities),
    buildWebAccessContext(capabilities),
    buildSubagentsContext(capabilities),
    ...contexts,
  ];
  const base = {
    ...body,
    id,
    ingestTraces: traceRecording.ingestTraces,
    exportRemoteTraces: traceRecording.exportRemoteTraces,
    attachUserId: getEffectiveAttachUserId({ agentsConfig, observability }),
    editPermission: permissions.edits,
    contexts: requestContexts,
    model: modelSelection,
    turnTraceContext: turnTraceContext ?? undefined,
    expectedRevision,
  };
  const [message] = toServerSafeUIMessages(
    enrichMessagesWithClientToolTimings({
      messages: messages.slice(-1),
      toolTimings,
    })
  );
  if (!message) {
    throw new Error("A chat submit request requires a message to send");
  }
  return { ...base, trigger: "submit-message", message };
}

/** Return a copy of resolved tool parts annotated with complete client timings. */
export function enrichMessagesWithClientToolTimings({
  messages,
  toolTimings,
}: {
  messages: AgentUIMessage[];
  toolTimings: ClientToolTimingRecorder | null;
}): AgentUIMessage[] {
  if (toolTimings == null) {
    return messages;
  }
  return messages.map((message) => {
    let hasChangedPart = false;
    const parts = message.parts.map((part) => {
      const isResolvedToolPart =
        isToolUIPart(part) &&
        (part.state === "output-available" || part.state === "output-error");
      if (!isResolvedToolPart) {
        return part;
      }
      const timing = toolTimings.get(part.toolCallId);
      if (timing == null) {
        return part;
      }
      hasChangedPart = true;
      const timingMetadata: ClientToolTimingMetadata = {
        clientStartedAt: timing.startedAt,
        clientEndedAt: timing.endedAt,
      };
      return {
        ...part,
        callProviderMetadata: {
          ...part.callProviderMetadata,
          phoenix: {
            ...part.callProviderMetadata?.phoenix,
            ...timingMetadata,
          },
        },
      };
    });
    return hasChangedPart ? { ...message, parts } : message;
  });
}
