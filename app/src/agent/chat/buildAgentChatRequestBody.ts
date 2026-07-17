import { isToolUIPart } from "ai";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { components } from "@phoenix/api/__generated__/v1";
import type { AgentModelSelection } from "@phoenix/components/agent/useGenerateSessionSummary";
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

type BuildAgentChatRequestBodyOptions = {
  /** Existing request body from the AI SDK transport, if any. */
  body: Partial<BuildAgentChatRequestBodyResult> | undefined;
  /** Chat identifier used by the transport for this conversation. */
  id: string;
  /** Full UI message history sent with the request. */
  messages: AgentUIMessage[];
  /** Reason the transport is sending this request. */
  trigger: "submit-message" | "regenerate-message";
  /** Optional message identifier for regenerate flows. */
  messageId: string | undefined;
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
  "client_started_at" | "client_ended_at"
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
 * are intentionally omitted because the server is the model-facing authority.
 */
export function buildAgentChatRequestBody({
  body,
  id,
  messages,
  trigger,
  messageId,
  capabilities,
  observability,
  agentsConfig,
  permissions,
  contexts,
  modelSelection,
  turnTraceContext = null,
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
  return {
    ...body,
    id,
    messages: toServerSafeUIMessages(
      enrichMessagesWithClientToolTimings({ messages, toolTimings })
    ),
    trigger,
    messageId,
    ingestTraces: traceRecording.ingestTraces,
    exportRemoteTraces: traceRecording.exportRemoteTraces,
    attachUserId: getEffectiveAttachUserId({ agentsConfig, observability }),
    editPermission: permissions.edits,
    contexts: requestContexts,
    model: modelSelection,
    turnTraceContext: turnTraceContext ?? undefined,
  };
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
        client_started_at: timing.startedAt,
        client_ended_at: timing.endedAt,
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
