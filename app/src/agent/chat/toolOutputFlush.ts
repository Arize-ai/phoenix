import type { components } from "@phoenix/api/__generated__/v1";

import { enrichMessagesWithClientToolTimings } from "./buildAgentChatRequestBody";
import type { ClientToolTimingRecorder } from "./clientToolTimings";
import { getFlushableClientToolOutputs } from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

type SubmitToolOutputsRequestBody =
  components["schemas"]["SubmitAgentSessionToolOutputsRequestBody"];

/**
 * Eagerly persists resolved client tool outputs while sibling tool calls on
 * the trailing assistant message are still pending.
 *
 * A turn that stops on several client tool approvals stays open until every
 * call resolves, so without flushing, the first Accept/Reject would sit on
 * its result client-side and the persisted transcript would not reflect it.
 * Each newly resolved output is posted to the session's tool-outputs
 * endpoint, which applies it under the turn lock without running the model.
 *
 * Flushing is best-effort: the endpoint ignores outputs for calls it has
 * already resolved, and the final chat continuation re-carries every resolved
 * output, so a failed or skipped flush loses nothing. Failed flushes are
 * simply retried on the next resolution event.
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
}) {
  const flushedToolCallIds = new Set<string>();
  let latestMessages: AgentUIMessage[] = [];
  // Serializes flush requests; a pass never observes an in-flight sibling.
  let flushQueue: Promise<void> = Promise.resolve();

  const isFlushed = (toolCallId: string): boolean =>
    flushedToolCallIds.has(toolCallId);

  const collectFlushableOutputs = () => {
    const trailingMessage = latestMessages.at(-1);
    if (!trailingMessage) {
      return { toolOutputs: [], lastMessageId: "" };
    }
    const [enrichedMessage] = enrichMessagesWithClientToolTimings({
      messages: [trailingMessage],
      toolTimings,
    });
    const enrichedMessages = [
      ...latestMessages.slice(0, -1),
      enrichedMessage ?? trailingMessage,
    ];
    return {
      toolOutputs: getFlushableClientToolOutputs({
        messages: enrichedMessages,
        isFlushed,
      }),
      lastMessageId: trailingMessage.id,
    };
  };

  const flushOnce = async (): Promise<void> => {
    const { toolOutputs, lastMessageId } = collectFlushableOutputs();
    if (toolOutputs.length === 0) {
      return;
    }
    const toolCallIds = toolOutputs.map((toolOutput) => toolOutput.toolCallId);
    let persisted = false;
    try {
      const body: SubmitToolOutputsRequestBody = {
        // The AI SDK's tool UI parts and the generated wire schema describe
        // the same Vercel data-stream shapes but spell optionality
        // differently.
        toolOutputs:
          toolOutputs as unknown as SubmitToolOutputsRequestBody["toolOutputs"],
        lastMessageId,
      };
      const response = await fetchFn(flushUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      persisted = response.ok;
    } catch {
      // Network failures are benign: the outputs stay eligible and the
      // final chat continuation re-carries them regardless.
    }
    if (!persisted) {
      // Leave the outputs for a later resolution event instead of retrying
      // in a tight loop; the chat continuation is the durable fallback.
      return;
    }
    toolCallIds.forEach((toolCallId) => flushedToolCallIds.add(toolCallId));
  };

  return {
    /**
     * Flush any newly resolved client tool outputs in the trailing assistant
     * message. Fire-and-forget: each call chains one flush pass onto the
     * queue, so outputs that resolve mid-flight post once the active request
     * settles.
     */
    maybeFlush: (messages: AgentUIMessage[]): void => {
      latestMessages = messages;
      // The catch keeps an unexpected rejection from wedging the queue.
      flushQueue = flushQueue.then(flushOnce).catch(() => {});
    },
    /** Reset all tracking when the logical turn completes. */
    clear: (): void => {
      flushedToolCallIds.clear();
      latestMessages = [];
    },
  };
}

export type ToolOutputFlusher = ReturnType<typeof createToolOutputFlusher>;
