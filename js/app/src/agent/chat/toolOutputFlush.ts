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
}): void {
  const enrichedMessage = enrichMessageWithClientToolMetadata({
    message,
    toolTimings,
    locallyInterruptedToolCallIds,
  });
  const toolOutputs = getFlushableClientToolOutputs({
    message: enrichedMessage,
    locallyInterruptedToolCallIds,
  });
  if (toolOutputs.length === 0) {
    return;
  }
  const body: SubmitToolOutputsRequestBody = {
    toolOutputs,
    lastMessageId: message.id,
  };
  void fetchFn(flushUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    // Benign: the chat continuation re-carries resolved outputs.
  });
}
