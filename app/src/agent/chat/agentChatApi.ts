import type { components, paths } from "@phoenix/api/__generated__/v1";
import { prependBasename } from "@phoenix/utils/routingUtils";

const CHAT_PATH_TEMPLATE =
  "/v1/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof paths;
const COMPACT_PATH_TEMPLATE =
  "/v1/agents/{agent_id}/sessions/{session_id}/compact" satisfies keyof paths;
const ASSISTANT_AGENT_ID = "assistant";

/**
 * The `code` discriminator of every HTTP 409 the agent session routes return,
 * from the server's `AgentSessionConflictError` OpenAPI schema.
 */
export type AgentSessionConflictCode =
  components["schemas"]["AgentSessionConflictError"]["code"];

/** Error code the chat endpoint returns when another client holds the lock. */
export const SESSION_BUSY_ERROR_CODE =
  "agent_session_busy" satisfies AgentSessionConflictCode;
/**
 * Error code the chat endpoint returns when the send's `lastMessageId` no
 * longer matches the persisted transcript — another client appended to the
 * session and this client is rendering a stale transcript.
 */
export const SESSION_MESSAGES_STALE_ERROR_CODE =
  "agent_session_messages_stale" satisfies AgentSessionConflictCode;
/**
 * Error code (HTTP 409) returned when a send or compaction asserts a model
 * the session is no longer on — another client moved it. Distinct from
 * {@link SESSION_MESSAGES_STALE_ERROR_CODE} because the transcript is unaffected: the
 * user is told their model changed, not that messages were refreshed.
 */
export const SESSION_MODEL_STALE_ERROR_CODE =
  "agent_session_model_stale" satisfies AgentSessionConflictCode;

const AGENT_SESSION_CONFLICT_CODES = [
  "agent_session_busy",
  "agent_session_model_stale",
  "agent_session_messages_stale",
  "agent_session_messages_conflict",
  "agent_session_compaction_conflict",
] as const satisfies readonly AgentSessionConflictCode[];

/**
 * Recover the conflict `code` from a failed request's error message.
 */
export function parseAgentSessionConflictCode(
  errorMessage: string
): AgentSessionConflictCode | null {
  try {
    const body: unknown = JSON.parse(errorMessage);
    if (typeof body === "object" && body !== null && "code" in body) {
      const parsedCode = (body as { code: unknown }).code;
      return (
        AGENT_SESSION_CONFLICT_CODES.find(
          (conflictCode) => conflictCode === parsedCode
        ) ?? null
      );
    }
  } catch {
    // The message is not a JSON body, so it cannot be a conflict rejection.
  }
  return null;
}

export function buildAgentChatApiUrl(sessionId: string): string {
  return prependBasename(
    CHAT_PATH_TEMPLATE.replace("{agent_id}", ASSISTANT_AGENT_ID).replace(
      "{session_id}",
      encodeURIComponent(sessionId)
    )
  );
}

export function buildAgentCompactApiUrl(sessionId: string): string {
  return prependBasename(
    COMPACT_PATH_TEMPLATE.replace("{agent_id}", ASSISTANT_AGENT_ID).replace(
      "{session_id}",
      encodeURIComponent(sessionId)
    )
  );
}
