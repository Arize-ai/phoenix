import type { components } from "@phoenix/api/__generated__/v1";

import { enrichMessagesWithClientToolTimings } from "./buildAgentChatRequestBody";
import type { ClientToolTimingRecorder } from "./clientToolTimings";
import { getFlushableClientToolOutputs } from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

type SubmitToolOutputsRequestBody =
  components["schemas"]["SubmitAgentSessionToolOutputsRequestBody"];

/**
 * Eagerly persists resolved client tool outputs while sibling tool calls are
 * still pending. Fire-and-forget and best-effort: the endpoint ignores
 * identical resends and the chat continuation re-carries every resolved
 * output.
 */
export function flushToolOutputs({
  message,
  flushUrl,
  fetch: fetchFn,
  toolTimings = null,
}: {
  /** The transcript's trailing assistant message. */
  message: AgentUIMessage;
  /** The session's tool-outputs endpoint URL. */
  flushUrl: string;
  /** Authenticated fetch used to post the outputs. */
  fetch: typeof fetch;
  /** Browser execution timings added to the flushed tool parts. */
  toolTimings?: ClientToolTimingRecorder | null;
}): void {
  const [enrichedMessage] = enrichMessagesWithClientToolTimings({
    messages: [message],
    toolTimings,
  });
  const toolOutputs = getFlushableClientToolOutputs({
    message: enrichedMessage ?? message,
  });
  if (toolOutputs.length === 0) {
    return;
  }
  const body: SubmitToolOutputsRequestBody = {
    // The AI SDK part types and the wire schema spell optionality
    // differently for the same shapes.
    toolOutputs:
      toolOutputs as unknown as SubmitToolOutputsRequestBody["toolOutputs"],
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
