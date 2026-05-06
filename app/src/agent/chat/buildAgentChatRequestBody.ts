import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
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
};

/** Request payload sent to the PXI agent chat endpoint. */
type BuildAgentChatRequestBodyResult = Record<string, unknown> & {
  /** Chat identifier used by the transport for this conversation. */
  id: string;
  /** Full UI message history sent with the request. */
  messages: AgentUIMessage[];
  /** Reason the transport is sending this request. */
  trigger: "submit-message" | "regenerate-message";
  /** Optional message identifier for regenerate flows. */
  messageId: string | undefined;
  /** Distinguishes normal chat turns from other PXI chat request types. */
  traceNameSuffix: "Turn";
  /** Whether to persist PXI traces in the current Phoenix instance. */
  ingestTraces: boolean;
  /** Whether to also export PXI traces to the configured remote collector. */
  exportRemoteTraces: boolean;
  /** Typed contexts advertised to the backend for this turn. */
  contexts: AgentContext[];
  /** Runtime capability snapshot advertised to the backend for this turn. */
  capabilities: AgentCapabilities;
};

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
 * Merges the AI SDK transport payload with PXI chat metadata. Tool definitions
 * are intentionally omitted because the server is the model-facing authority.
 *
 * The exported request body includes two agent-specific additions beyond the
 * raw AI SDK payload: runtime capabilities and typed UI contexts. Tool
 * definitions and prompt assembly are owned by the server.
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
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  // Prepend volatile app context so server-rendered per-turn context includes
  // the current browser-local clock alongside stable route/mounted contexts.
  const requestContexts = [buildCurrentAppContext(), ...contexts];
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    traceNameSuffix: "Turn",
    ingestTraces: observability.storeLocalTraces,
    exportRemoteTraces: observability.exportRemoteTraces && hasRemoteCollector,
    contexts: requestContexts,
    capabilities,
  };
}
