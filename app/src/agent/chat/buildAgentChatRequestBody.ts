/**
 * For the workflow to add, edit, or remove a frontend tool, see
 * `.agents/skills/phoenix-pxi/rules/extending-frontend-tool-registry.md`.
 */
import {
  buildAgentCapabilitySystemPrompt,
  type AgentCapabilities,
} from "@phoenix/agent/extensions/capabilities";
import type { AgentObservabilitySettings } from "@phoenix/store/agentStore";

import { agentToolDefinitions } from "./chatTools";
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
  /** System prompt from agent settings (persisted in the agent store). */
  systemPrompt: string;
  /** Optional PXI session id used to associate traces across turns. */
  sessionId?: string | null;
  /** Runtime capability snapshot to expose to the model for this turn. */
  capabilities: AgentCapabilities;
  /** Per-user PXI observability settings for this request. */
  observability: AgentObservabilitySettings;
  /** Whether a remote collector is configured for this Phoenix instance. */
  hasRemoteCollector: boolean;
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
  /** System prompt applied to PXI agent chat requests. */
  system: string;
  /** Frontend tool definitions exposed for client-side execution. */
  tools: typeof agentToolDefinitions;
  /** Distinguishes normal chat turns from other PXI chat request types. */
  traceNameSuffix: "Turn";
  /** Optional PXI session id used to associate traces across turns. */
  sessionId?: string;
  /** Whether to persist PXI traces in the current Phoenix instance. */
  ingestTraces: boolean;
  /** Whether to also export PXI traces to the configured remote collector. */
  exportRemoteTraces: boolean;
};

function buildSystemPrompt({
  systemPrompt,
  capabilities,
}: {
  systemPrompt: string;
  capabilities: AgentCapabilities;
}): string {
  const capabilityPrompt = buildAgentCapabilitySystemPrompt({ capabilities });

  return capabilityPrompt
    ? `${systemPrompt}\n\n${capabilityPrompt}`
    : systemPrompt;
}

/**
 * Merges the AI SDK transport payload with the frontend tool definitions that
 * the agent chat API expects for client-side tool execution.
 *
 * The exported request body includes three agent-specific additions beyond the
 * raw AI SDK payload: the base system prompt, the current runtime capability
 * summary, and the frontend tool definitions the model may call.
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
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    system: buildSystemPrompt({ systemPrompt, capabilities }),
    tools: agentToolDefinitions,
    traceNameSuffix: "Turn",
    ingestTraces: observability.storeLocalTraces,
    exportRemoteTraces: observability.exportRemoteTraces && hasRemoteCollector,
    ...(sessionId ? { sessionId } : {}),
  };
}
