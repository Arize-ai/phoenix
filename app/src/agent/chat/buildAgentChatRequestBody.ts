import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { AgentObservabilitySettings } from "@phoenix/store/agentStore";

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
  /** User-editable instructions from agent settings (persisted in the agent store). */
  systemPrompt: string;
  /** Optional PXI session id used to associate traces across turns. */
  sessionId?: string | null;
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
  /** User-editable instructions inserted into the server-owned PXI system prompt. */
  userInstructions: string;
  /** Distinguishes normal chat turns from other PXI chat request types. */
  traceNameSuffix: "Turn";
  /** Optional PXI session id used to associate traces across turns. */
  sessionId?: string;
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
 * Merges the AI SDK transport payload with PXI chat metadata. Tool definitions
 * are intentionally omitted because the server is the model-facing authority.
 *
 * The exported request body includes three agent-specific additions beyond the
 * raw AI SDK payload: custom user instructions, runtime capabilities, and typed
 * UI contexts. Tool definitions and prompt assembly are owned by the server.
 */
export function buildAgentChatRequestBody({
  body,
  id,
  messages,
  trigger,
  messageId,
  systemPrompt,
  sessionId,
  capabilities,
  observability,
  hasRemoteCollector,
  contexts,
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    userInstructions: systemPrompt,
    traceNameSuffix: "Turn",
    ingestTraces: observability.storeLocalTraces,
    exportRemoteTraces: observability.exportRemoteTraces && hasRemoteCollector,
    contexts,
    capabilities,
    ...(sessionId ? { sessionId } : {}),
  };
}
