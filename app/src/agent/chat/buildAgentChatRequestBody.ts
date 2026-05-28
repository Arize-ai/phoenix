import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { components } from "@phoenix/api/__generated__/v1";
import type { AgentModelSelection } from "@phoenix/components/agent/useGenerateSessionSummary";
import type {
  AgentObservabilitySettings,
  AgentPermissions,
} from "@phoenix/store/agentStore";
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
  /** Per-user PXI approval permission settings for this request. */
  permissions: AgentPermissions;
  /** Whether a remote collector is configured for this Phoenix instance. */
  hasRemoteCollector: boolean;
  /** Typed page and mounted UI contexts for the current turn. */
  contexts: AgentContext[];
  /** Provider + model selection for this turn. */
  modelSelection: AgentModelSelection;
  /**
   * Effective web-access value for this turn, after composing the global
   * `web.access` capability with any per-session override. Forwarded to the
   * backend as the web access context.
   */
  webAccessEnabled: boolean;
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
 * Build web access context from the effective web-access value.
 *
 * Forwards the user's effective web access decision (global capability
 * composed with any per-session override) to the backend as a typed context.
 */
function buildWebAccessContext(webAccessEnabled: boolean): AgentContext {
  return {
    type: "web_access",
    enabled: webAccessEnabled,
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
  permissions,
  hasRemoteCollector,
  contexts,
  modelSelection,
  webAccessEnabled,
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  const requestContexts = [
    buildCurrentAppContext(),
    buildGraphQLContext(capabilities),
    buildWebAccessContext(webAccessEnabled),
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
    editPermission: permissions.edits,
    contexts: requestContexts,
    model: modelSelection,
  };
}
