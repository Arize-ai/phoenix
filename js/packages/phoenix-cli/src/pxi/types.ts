import type { componentsV1 } from "@arizeai/phoenix-client";
import type { ChatTransport, UIMessage } from "ai";

import type { PhoenixConfig } from "../config";

/**
 * Shared types for the PXI terminal chat.
 *
 * Wire types are derived from the generated OpenAPI schema so the CLI and the
 * server stay in lockstep at compile time. The exception is the chat message
 * itself: the streaming layer is driven by the Vercel AI SDK, so
 * {@link PxiMessage} is typed by the SDK's `UIMessage` rather than the
 * schema's structural equivalent.
 */

type SchemasV1 = componentsV1["schemas"];

/**
 * Extra metadata the server attaches to each assistant message — the session it
 * belongs to, the Phoenix trace it produced (so the UI can link back to it), and
 * token usage. Fields are nullable because tracing and usage reporting are
 * optional and may be disabled server-side.
 */
export type PhoenixAssistantMessageMetadata =
  SchemasV1["PhoenixAssistantMessageMetadata"];

/**
 * `UIMessage.metadata` as a registry of namespaces: Phoenix's own fields under
 * `phoenix`, pydantic-ai's message-level round-trip channel under `pydantic_ai`.
 */
export type PxiMessageMetadata = SchemasV1["MessageMetadata"];

/** Transient data chunks streamed alongside assistant message content. */
type PxiDataTypes = {
  "session-summary": SchemasV1["SessionSummaryChunk"]["data"];
  "transcript-persisted": SchemasV1["TranscriptPersistedChunk"]["data"];
};

/** A chat message (user or assistant) carrying PXI-specific metadata. */
export type PxiMessage = UIMessage<PxiMessageMetadata, PxiDataTypes>;

export type BuiltInProvider = SchemasV1["ModelProvider"];

/**
 * Which model PXI should talk to. Either a built-in provider keyed by name
 * (e.g. `ANTHROPIC` + `claude-opus-4-6`) or a custom provider configured in
 * Phoenix and addressed by its server-side id.
 */
export type ModelSelection = SchemasV1["AgentModelSelection"];

/**
 * A capability/environment hint sent alongside the conversation so the server
 * agent knows what it is allowed to do and the world it is operating in — the
 * caller's local clock and time zone, and whether web access and subagents
 * are enabled for this run. A subset of the server's full `ChatContext`
 * union: the rest are browser-only surfaces.
 */
export type PxiContext = Extract<
  SchemasV1["ChatContext"],
  { type: "app" | "web_access" | "subagents" }
>;

/**
 * How edit-style tool calls are gated: `"manual"` requires the user to approve
 * each one, `"bypass"` lets them run unattended (where the server supports it).
 */
export type PxiEditPermission = NonNullable<
  SchemasV1["ChatRequestBody"]["editPermission"]
>;

/**
 * The request body POSTed to the agent-session chat endpoint. The server owns
 * the session transcript, so each turn carries only its trailing message.
 *
 * Derived from the generated `ChatRequestBody` schema, with every field the CLI
 * sends made required (the schema marks server-defaulted fields optional) and
 * `message` swapped for the SDK-typed {@link PxiMessage}. Fields the CLI never
 * sends (`requestedSkills`, `turnTraceContext`, and `toolOutputs` — the CLI
 * executes no client tools, so it has no tool outputs to submit) are omitted.
 */
export type PxiChatRequest = Required<
  Omit<
    SchemasV1["ChatRequestBody"],
    "message" | "requestedSkills" | "turnTraceContext" | "toolOutputs"
  >
> & {
  message: PxiMessage;
};

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
  /**
   * Whether `--provider`/`--model`/`--custom-provider-id` were passed. Those
   * flags express an intent to move a restored session onto that model, so
   * restoring writes it rather than shadowing the persisted value locally.
   */
  hasExplicitModelSelection: boolean;
  skipModelPreflight: boolean;
  enableWebAccess: boolean;
  enableSubagents: boolean;
  editPermission: PxiEditPermission;
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  attachUserId: boolean;
};

/** A persisted server-side chat session shown in the session picker. */
export type PxiSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  isTemporary: boolean;
};

/** A session and its canonical persisted transcript. */
export type PxiSession = PxiSessionSummary & {
  messages: PxiMessage[];
  model: ModelSelection;
  /**
   * Whether another client currently holds the session's server-side lock.
   * Absent means no lock is held.
   */
  isActive?: boolean;
  /**
   * The message ID of the most recently persisted transcript message, or
   * null for an empty transcript.
   */
  lastMessageId?: string | null;
};

/**
 * Cheap synchronization probe for a session: whether another client's turn
 * holds the lock and where the persisted transcript's tail currently is.
 * Polling fetches this instead of the full transcript and only downloads
 * messages when the tail has moved.
 */
export type PxiSessionSyncState = {
  isActive: boolean;
  updatedAt: string;
  lastMessageId: string | null;
};

/**
 * The outcome of a compaction request. `compacted` is true when a new
 * checkpoint was persisted, and `compactionMessage` is that checkpoint. A
 * no-op — the conversation was already as compact as it can get — yields
 * `compacted: false` with no message.
 */
export type PxiCompactionResult = {
  compacted: boolean;
  compactionMessage: PxiMessage | null;
};

/** Server-side session operations used by the chat UI. */
export type PxiSessionClient = {
  createSession: (options: {
    temporary: boolean;
    model: ModelSelection;
  }) => Promise<PxiSession>;
  listSessions: () => Promise<PxiSessionSummary[]>;
  getSession: (options: { sessionId: string }) => Promise<PxiSession>;
  getSessionSyncState: (options: {
    sessionId: string;
  }) => Promise<PxiSessionSyncState>;
  /**
   * Change the model a persisted session runs on, returning the selection in
   * effect. Turns assert the model they expect rather than setting it, so this
   * is the only way to move an existing session to a different model.
   */
  patchSessionModel: (options: {
    sessionId: string;
    model: ModelSelection;
  }) => Promise<ModelSelection>;
  compactSession: (options: {
    sessionId: string;
    model: ModelSelection;
  }) => Promise<PxiCompactionResult>;
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
    onSessionTitle?: (title: string) => void;
  }) => Promise<PxiMessage | null>;
};

/** The AI SDK chat transport specialized to {@link PxiMessage}. */
export type PxiTransport = ChatTransport<PxiMessage>;
