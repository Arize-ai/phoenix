import type { components } from "@phoenix/api/__generated__/v1";

import { enrichMessagesWithClientToolTimings } from "./buildAgentChatRequestBody";
import type { ClientToolTimingRecorder } from "./clientToolTimings";
import { getFlushableClientToolOutputs } from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

type SubmitToolOutputsRequestBody =
  components["schemas"]["SubmitAgentSessionToolOutputsRequestBody"];

/**
 * Eagerly persists resolved client tool outputs while sibling tool calls are
 * still pending; best-effort, since the chat continuation re-carries them all.
 *
 * Returns a stateless fire-and-forget flush: each call posts every resolved
 * output on the trailing assistant message and the endpoint ignores the ones
 * it already persisted, so overlapping or failed posts lose nothing.
 */
export function createToolOutputFlusher({
  flushUrl,
  fetch: fetchFn,
  toolTimings = null,
}: {
  /** The session's tool-outputs endpoint URL. */
  flushUrl: string;
  /** Authenticated fetch used to post the outputs. */
  fetch: typeof fetch;
  /** Browser execution timings added to the flushed tool parts. */
  toolTimings?: ClientToolTimingRecorder | null;
}): (messages: AgentUIMessage[]) => void {
  return (messages) => {
    const trailingMessage = messages.at(-1);
    if (!trailingMessage) {
      return;
    }
    const [enrichedMessage] = enrichMessagesWithClientToolTimings({
      messages: [trailingMessage],
      toolTimings,
    });
    const toolOutputs = getFlushableClientToolOutputs({
      messages: [...messages.slice(0, -1), enrichedMessage ?? trailingMessage],
    });
    if (toolOutputs.length === 0) {
      return;
    }
    const body: SubmitToolOutputsRequestBody = {
      // The AI SDK's tool UI parts and the generated wire schema describe
      // the same Vercel data-stream shapes but spell optionality
      // differently.
      toolOutputs:
        toolOutputs as unknown as SubmitToolOutputsRequestBody["toolOutputs"],
      lastMessageId: trailingMessage.id,
    };
    void fetchFn(flushUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      // Failures are benign: the chat continuation re-carries every
      // resolved output regardless.
    });
  };
}

export type ToolOutputFlusher = ReturnType<typeof createToolOutputFlusher>;
