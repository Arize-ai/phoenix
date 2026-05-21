import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { components } from "@phoenix/api/__generated__/v1";
import type { AgentModelSelection } from "@phoenix/components/agent/useGenerateSessionSummary";
import type { AgentObservabilitySettings } from "@phoenix/store/agentStore";
import { getTimeZone, toLocalISOWithOffset } from "@phoenix/utils/timeUtils";

import type { AgentUIMessage } from "./types";

type BuildAgentChatRequestBodyOptions = {
  /** Existing request body from the AI SDK transport, if any. */
  body: Record<string, unknown> | undefined;
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
  /** Whether a remote collector is configured for this Phoenix instance. */
  hasRemoteCollector: boolean;
  /** Typed page and mounted UI contexts for the current turn. */
  contexts: AgentContext[];
  /** Provider + model selection for this turn. */
  modelSelection: AgentModelSelection;
};

type BuildAgentChatRequestBodyResult = components["schemas"]["ChatRequest"];

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
    mutationsEnabled: capabilities["graphql.mutations"],
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
    enabled: capabilities["web.access"],
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
  hasRemoteCollector,
  contexts,
  modelSelection,
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  const requestContexts = [
    buildCurrentAppContext(),
    buildGraphQLContext(capabilities),
    buildWebAccessContext(capabilities),
    ...contexts,
  ];
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    ingestTraces: observability.storeLocalTraces,
    exportRemoteTraces: observability.exportRemoteTraces && hasRemoteCollector,
    contexts: requestContexts,
    model: modelSelection,
  };
}
