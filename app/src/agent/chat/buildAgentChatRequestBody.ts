import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { components } from "@phoenix/api/__generated__/v1";
import {
  getEffectiveTraceRecordingSettings,
  type AgentObservabilitySettings,
  type AgentPermissions,
  type AgentServerConfig,
} from "@phoenix/store/agentStore";
import { getTimeZone, toLocalISOWithOffset } from "@phoenix/utils/timeUtils";

import type { AgentUIMessage } from "./types";

export type AgentModelSelection =
  components["schemas"]["ChatSubmitMessage"]["model"];

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
};

type BuildAgentChatRequestBodyResult = components["schemas"]["ChatRequest"];

export type AgentChatRequestBodyPatch = Pick<
  BuildAgentChatRequestBodyResult,
  "requestedSkills"
>;

/**
 * Build request-only browser clock context for resolving relative time phrases.
 *
 * This is intentionally generated at send time instead of stored in agent
 * state: it changes every turn and should not appear as user-visible page
 * context.
 */
function buildCurrentAppContext(): AgentContext {
  const now = new Date();
  const timeZone = getTimeZone();
  return {
    type: "app",
    currentDateTime: toLocalISOWithOffset(now, timeZone),
    timeZone,
  };
}

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
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  const traceRecording = getEffectiveTraceRecordingSettings({
    agentsConfig,
    observability,
  });
  const requestContexts = [
    buildCurrentAppContext(),
    buildGraphQLContext(capabilities),
    buildWebAccessContext(capabilities),
    buildSubagentsContext(capabilities),
    ...contexts,
  ];
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    ingestTraces: traceRecording.ingestTraces,
    exportRemoteTraces: traceRecording.exportRemoteTraces,
    attachUserId: observability.attachUserId,
    editPermission: permissions.edits,
    contexts: requestContexts,
    model: modelSelection,
  };
}
