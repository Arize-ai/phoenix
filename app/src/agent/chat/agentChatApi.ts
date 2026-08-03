import type { paths } from "@phoenix/api/__generated__/v1";
import { prependBasename } from "@phoenix/utils/routingUtils";

const CHAT_PATH_TEMPLATE =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof paths;
const COMPACT_PATH_TEMPLATE =
  "/agents/{agent_id}/sessions/{session_id}/compact" satisfies keyof paths;
const ASSISTANT_AGENT_ID = "assistant";

/** Error code the chat endpoint returns when another client holds the lock. */
export const SESSION_BUSY_ERROR_CODE = "agent_session_busy";
/**
 * Error code the chat endpoint returns when the send's `lastMessageId` no
 * longer matches the persisted transcript — another client appended to the
 * session and this client is rendering a stale transcript.
 */
export const SESSION_STALE_ERROR_CODE = "agent_session_stale";

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
