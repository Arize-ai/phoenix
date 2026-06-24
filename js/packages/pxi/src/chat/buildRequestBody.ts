import type {
  AgentUIMessage,
  ChatContext,
  ChatRegenerateMessage,
  ChatRequestBody,
  ChatSubmitMessage,
  ModelSelection,
} from "./types";

export type BuildRequestBodyOptions = {
  /** Chat/session identifier for this conversation. */
  id: string;
  /** Full UI message history to send with the request. */
  messages: AgentUIMessage[];
  /** Why the transport is sending this request. */
  trigger: "submit-message" | "regenerate-message";
  /** Message id to regenerate (regenerate flows only). */
  messageId: string | undefined;
  /** Provider + model selection for this turn. */
  model: ModelSelection;
};

/**
 * Request-only browser-clock context so the agent can resolve relative time
 * phrases ("yesterday", "last hour"). Mirrors `buildCurrentAppContext` in the
 * Phoenix web app — generated fresh per turn rather than stored.
 */
function buildAppContext(): ChatContext {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { type: "app", currentDateTime: now.toISOString(), timeZone };
}

/**
 * Build the typed `ChatRequest` body for the server-agent chat endpoint.
 *
 * The CLI runs without the web app's capability store, so capability-derived
 * contexts are omitted and the server's defaults apply. Tool definitions are
 * intentionally not sent: the server agent is the model-facing authority and
 * runs its own tools server-side.
 */
export function buildRequestBody({
  id,
  messages,
  trigger,
  messageId,
  model,
}: BuildRequestBodyOptions): ChatRequestBody {
  // The AI SDK UIMessage and the server's AssistantMetadataUIMessage share the
  // same wire shape; the server validates the richer structure at runtime.
  const wireMessages = messages as unknown as ChatSubmitMessage["messages"];
  const shared = {
    id,
    messages: wireMessages,
    model,
    contexts: [buildAppContext()],
    ingestTraces: false,
    exportRemoteTraces: false,
    attachUserId: false,
    editPermission: "manual" as const,
    requestedSkills: [],
  };

  if (trigger === "regenerate-message") {
    return {
      ...shared,
      trigger: "regenerate-message",
      messageId: messageId ?? null,
    } satisfies ChatRegenerateMessage;
  }

  return {
    ...shared,
    trigger: "submit-message",
  } satisfies ChatSubmitMessage;
}
