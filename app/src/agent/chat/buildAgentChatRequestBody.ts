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

import { isResolvedClientToolOutputPart } from "./chatUtils";
import type { ClientToolTimingRecorder } from "./clientToolTimings";
import { toServerSafeUIMessages } from "./serverSafeMessages";
import type { LocallyInterruptedToolCallIds } from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

export type AgentModelSelection =
  components["schemas"]["ChatRequestBody"]["model"];

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
  /** Browser execution timings added to completed client-tool parts. */
  toolTimings?: ClientToolTimingRecorder | null;
  /** Tool calls this client resolved as interrupted. */
  locallyInterruptedToolCallIds?: LocallyInterruptedToolCallIds;
};

type BuildAgentChatRequestBodyResult = components["schemas"]["ChatRequestBody"];

/**
 * Browser-recorded execution timings added to the `phoenix` namespace of
 * `callProviderMetadata` on resolved client-tool parts. Picked from the
 * generated wire contract so a server-side rename fails compilation here.
 */
type ClientToolTimingMetadata = Pick<
  components["schemas"]["PhoenixToolCallCallbackProviderMetadata"],
  "clientStartedAt" | "clientEndedAt"
>;

/**
 * A tool part in a terminal AI SDK output state (`output-available` /
 * `output-error`), as the chat endpoint's `toolOutputs` field models it.
 */
type ChatToolOutput = NonNullable<
  BuildAgentChatRequestBodyResult["toolOutputs"]
>[number];

/**
 * Extract the assistant message's resolved client-executed tool parts — the
 * `toolOutputs` a send may carry. The server matches them by `toolCallId`,
 * applies them to its persisted copy of the message, and ignores outputs for
 * tool calls it has already resolved, so resending is idempotent.
 */
function getClientToolOutputs(message: AgentUIMessage): ChatToolOutput[] {
  return message.parts.filter((part) => isResolvedClientToolOutputPart(part));
}

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
  toolTimings = null,
  locallyInterruptedToolCallIds = {},
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
    headless: false,
    recordLocalTraces: traceRecording.ingestTraces,
    exportRemoteTraces: traceRecording.exportRemoteTraces,
    instrumentUserId: getEffectiveAttachUserId({ agentsConfig, observability }),
    editPermission: permissions.edits,
    contexts: requestContexts,
    model: modelSelection,
  };
  const trailingMessage = messages.at(-1);
  if (!trailingMessage) {
    throw new Error("A chat submit request requires a message to send");
  }
  if (trailingMessage.role === "assistant") {
    // Client-tool continuation: the server owns the assistant message, so
    // only the resolved client tool outputs are sent, not the message itself.
    const enrichedAssistant = enrichMessageWithClientToolMetadata({
      message: trailingMessage,
      toolTimings,
      locallyInterruptedToolCallIds,
    });
    const toolOutputs = getClientToolOutputs(enrichedAssistant);
    if (toolOutputs.length === 0) {
      throw new Error(
        "A chat continuation requires resolved client tool outputs to send"
      );
    }
    return {
      ...base,
      trigger: "submit-message",
      toolOutputs,
      lastMessageId: getLastPersistedMessageId(messages),
    };
  }
  const [message] = toServerSafeUIMessages([
    enrichMessageWithClientToolMetadata({
      message: trailingMessage,
      toolTimings,
      locallyInterruptedToolCallIds,
    }),
  ]);
  if (!message) {
    throw new Error("A chat submit request requires a message to send");
  }
  // A new user message supersedes the previous assistant turn. Any of its
  // client tool results that never reached the server (e.g. tools marked as
  // interrupted after Stop) ride along as toolOutputs so the persisted
  // transcript resolves them; the server ignores already-resolved calls and
  // authoritatively marks anything still unresolved as interrupted.
  const precedingMessage = messages.at(-2);
  const toolOutputs =
    precedingMessage?.role === "assistant"
      ? getClientToolOutputs(
          enrichMessageWithClientToolMetadata({
            message: precedingMessage,
            toolTimings,
            locallyInterruptedToolCallIds,
          })
        )
      : [];
  return {
    ...base,
    trigger: "submit-message",
    message,
    ...(toolOutputs.length > 0 ? { toolOutputs } : {}),
    lastMessageId: getLastPersistedMessageId(messages),
  };
}

/**
 * The id of the last transcript message this client believes is persisted —
 * the send's optimistic-concurrency check. A new user message at the tail is
 * the turn being submitted, so the message before it is the last persisted
 * one; a trailing assistant message (the client-tool continuation path) is
 * itself the transcript's persisted tail. Undefined (omitted on the wire)
 * when the transcript is empty.
 */
function getLastPersistedMessageId(
  messages: AgentUIMessage[]
): string | undefined {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return undefined;
  }
  return lastMessage.role === "assistant"
    ? lastMessage.id
    : messages.at(-2)?.id;
}

/**
 * Return a copy of the message whose resolved tool parts are annotated with
 * client execution timings and, where marked, the interrupted outcome.
 */
export function enrichMessageWithClientToolMetadata({
  message,
  toolTimings,
  locallyInterruptedToolCallIds = {},
}: {
  message: AgentUIMessage;
  toolTimings: ClientToolTimingRecorder | null;
  locallyInterruptedToolCallIds?: LocallyInterruptedToolCallIds;
}): AgentUIMessage {
  let hasChangedPart = false;
  const parts = message.parts.map((part) => {
    const isResolvedToolPart =
      isToolUIPart(part) &&
      (part.state === "output-available" || part.state === "output-error");
    if (!isResolvedToolPart) {
      return part;
    }
    const timing = toolTimings?.get(part.toolCallId) ?? null;
    const isInterrupted =
      locallyInterruptedToolCallIds[part.toolCallId] === true;
    if (timing == null && !isInterrupted) {
      return part;
    }
    hasChangedPart = true;
    const timingMetadata: ClientToolTimingMetadata | null =
      timing == null
        ? null
        : {
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
          ...(isInterrupted ? { outcome: "interrupted" as const } : null),
        },
      },
    };
  });
  return hasChangedPart ? { ...message, parts } : message;
}
