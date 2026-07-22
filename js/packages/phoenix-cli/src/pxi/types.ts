import type { ChatTransport, UIMessage } from "ai";

import type { PhoenixConfig } from "../config";

/**
 * Shared types for the PXI terminal chat.
 *
 * These mirror the wire contract of the Phoenix server-agent chat endpoint so
 * the CLI and the server stay in lockstep: the CLI sends a {@link PxiChatRequest}
 * and renders the streamed {@link PxiMessage}s it gets back.
 */

/**
 * Extra metadata the server attaches to each assistant message — the session it
 * belongs to, the Phoenix trace it produced (so the UI can link back to it), and
 * token usage. Fields are nullable because tracing and usage reporting are
 * optional and may be disabled server-side.
 */
export type AssistantMessageMetadata = {
  sessionId: string;
  trace?: {
    traceId: string;
    rootSpanId: string;
  } | null;
  usage?: {
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    promptDetails?: {
      cacheRead: number;
      cacheWrite: number;
    } | null;
  } | null;
};

/** A chat message (user or assistant) carrying PXI-specific metadata. */
export type PxiMessage = UIMessage<AssistantMessageMetadata>;

export type BuiltInProvider =
  | "ANTHROPIC"
  | "AWS"
  | "AZURE_OPENAI"
  | "CEREBRAS"
  | "DEEPSEEK"
  | "FIREWORKS"
  | "GOOGLE"
  | "GROQ"
  | "MOONSHOT"
  | "OLLAMA"
  | "OPENAI"
  | "PERPLEXITY"
  | "TOGETHER"
  | "XAI";

/**
 * Which model PXI should talk to. Either a built-in provider keyed by name
 * (e.g. `ANTHROPIC` + `claude-opus-4-6`) or a custom provider configured in
 * Phoenix and addressed by its server-side id.
 */
export type ModelSelection =
  | {
      providerType: "builtin";
      provider: BuiltInProvider;
      modelName: string;
    }
  | {
      providerType: "custom";
      providerId: string;
      modelName: string;
    };

/**
 * A capability/environment hint sent alongside the conversation so the server
 * agent knows what it is allowed to do and the world it is operating in — the
 * caller's local clock and time zone, whether GraphQL mutations are permitted,
 * and whether web access and subagents are enabled for this run.
 */
export type PxiContext =
  | {
      type: "app";
      currentDateTime: string;
      timeZone: string;
    }
  | {
      type: "graphql";
      mutationsEnabled: boolean;
    }
  | {
      type: "web_access";
      enabled: boolean;
    }
  | {
      type: "subagents";
      enabled: boolean;
    };

/**
 * How edit-style tool calls are gated: `"manual"` requires the user to approve
 * each one, `"bypass"` lets them run unattended (where the server supports it).
 */
export type PxiEditPermission = "manual" | "bypass";

/**
 * The request body POSTed to the agent-session chat endpoint
 * (`/agents/server/sessions/{session_id}/chat`). The server owns the
 * session transcript, so each turn carries only its trailing message.
 */
export type PxiChatRequest = {
  id: string;
  message: PxiMessage;
  trigger: "submit-message";
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  attachUserId: boolean;
  editPermission: PxiEditPermission;
  contexts: PxiContext[];
  model: ModelSelection;
};

/**
 * The request body POSTed to the deprecated stateless server-agent endpoint
 * (`/agents/server/sessions/{session_id}/chat`) on Phoenix servers that
 * predate agent-session persistence. The client owns the transcript and
 * resends the full `messages` history each turn.
 */
export type PxiLegacyChatRequest = {
  id: string;
  messages: PxiMessage[];
  trigger: "submit-message";
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  attachUserId: boolean;
  editPermission: PxiEditPermission;
  contexts: PxiContext[];
  model: ModelSelection;
};

/**
 * Which chat wire contract the session uses. `"agent-session"` is the current
 * contract: a server-side `AgentSession` is created up front and each turn
 * sends only its trailing message. `"legacy-server-agent"` is the fallback for
 * older Phoenix servers without agent-session persistence: the client mints
 * its own session id and resends the full transcript each turn.
 */
export type PxiTransportMode = "agent-session" | "legacy-server-agent";

/**
 * The fully-resolved configuration for a single PXI session, produced by
 * merging CLI flags, the active profile, and defaults. Everything the UI and
 * client need to run is captured here, so the rest of the code can treat it as
 * the single source of truth rather than re-reading flags or config.
 */
export type PxiRuntimeOptions = {
  sessionId: string;
  config: PhoenixConfig;
  modelSelection: ModelSelection;
  transportMode: PxiTransportMode;
  skipModelPreflight: boolean;
  enableWebAccess: boolean;
  enableSubagents: boolean;
  enableGraphqlMutations: boolean;
  editPermission: PxiEditPermission;
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  attachUserId: boolean;
};

/**
 * The interface the UI uses to talk to PXI. `sendMessage` streams an assistant
 * reply: `onAssistantMessage` fires on every incremental update so the UI can
 * re-render mid-stream, and the promise resolves with the final message (or
 * `null` if nothing was produced). Defining this as an interface lets tests
 * swap in a fake client without a real network transport.
 */
export type PxiChatClient = {
  sendMessage: (options: {
    messages: PxiMessage[];
    abortSignal?: AbortSignal;
    onAssistantMessage: (message: PxiMessage) => void;
  }) => Promise<PxiMessage | null>;
};

/** The AI SDK chat transport specialized to {@link PxiMessage}. */
export type PxiTransport = ChatTransport<PxiMessage>;
