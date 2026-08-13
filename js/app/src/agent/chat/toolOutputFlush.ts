import type { components } from "@phoenix/api/__generated__/v1";

import { enrichMessageWithClientToolMetadata } from "./buildAgentChatRequestBody";
import type { ClientToolTimingRecorder } from "./clientToolTimings";
import {
  getFlushableClientToolOutputs,
  type LocallyInterruptedToolCallIds,
} from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

type SubmitToolOutputsRequestBody =
  components["schemas"]["SubmitAgentSessionToolOutputsRequestBody"];

/**
 * Eagerly persists resolved client tool outputs while sibling tool calls are
 * still pending.
 */
export function flushToolOutputs({
  message,
  flushUrl,
  fetch: fetchFn,
  toolTimings = null,
  locallyInterruptedToolCallIds = {},
  syncedToolOutputIds = null,
}: {
  /** The transcript's trailing assistant message. */
  message: AgentUIMessage;
  /** The session's tool-outputs endpoint URL. */
  flushUrl: string;
  /** Authenticated fetch used to post the outputs. */
  fetch: typeof fetch;
  /** Browser execution timings added to the flushed tool parts. */
  toolTimings?: ClientToolTimingRecorder | null;
  /** Tool calls this client resolved as interrupted; suppresses the flush. */
  locallyInterruptedToolCallIds?: LocallyInterruptedToolCallIds;
  /**
   * Tool-call IDs whose outputs the server already holds; they are skipped,
   * and the set is updated in place as flushes go out. Without this the flush
   * re-posts outputs the server persisted with the transcript, and each
   * redundant POST briefly claims the session turn lock — racing (and 409ing)
   * a chat continuation sent at the same moment, e.g. a mutation approval.
   */
  syncedToolOutputIds?: Set<string> | null;
}): void {
  const enrichedMessage = enrichMessageWithClientToolMetadata({
    message,
    toolTimings,
    locallyInterruptedToolCallIds,
  });
  const toolOutputs = getFlushableClientToolOutputs({
    message: enrichedMessage,
    locallyInterruptedToolCallIds,
  }).filter((part) => !syncedToolOutputIds?.has(part.toolCallId));
  if (toolOutputs.length === 0) {
    return;
  }
  const body: SubmitToolOutputsRequestBody = {
    toolOutputs,
    lastMessageId: message.id,
  };
  // Marked before the response lands so an overlapping evaluation (each
  // approval response re-runs sendAutomaticallyWhen) doesn't double-post.
  const flushedToolCallIds = toolOutputs.map((part) => part.toolCallId);
  for (const toolCallId of flushedToolCallIds) {
    syncedToolOutputIds?.add(toolCallId);
  }
  void fetchFn(flushUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Tool output flush failed: ${response.status}`);
      }
    })
    .catch(() => {
      // Benign: the chat continuation re-carries resolved outputs. Unmark so
      // a later flush may retry before that continuation happens.
      for (const toolCallId of flushedToolCallIds) {
        syncedToolOutputIds?.delete(toolCallId);
      }
    });
}
