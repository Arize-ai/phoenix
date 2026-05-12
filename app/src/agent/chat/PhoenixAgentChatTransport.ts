import { DefaultChatTransport, type UIMessageChunk } from "ai";
import type { UIMessage } from "ai";

type AbortableStreamOptions<TChunk> = {
  stream: ReadableStream<TChunk>;
  signal: AbortSignal;
};

/**
 * Stops forwarding UI message chunks as soon as the request is aborted.
 *
 * AI SDK's `stop()` aborts the fetch signal, but queued stream work can still
 * unwind after a newer request has started. This wrapper makes abort a local
 * client boundary by cancelling the reader and closing the stream seen by AI
 * SDK's message writer.
 */
export function closeStreamOnAbort<TChunk>({
  stream,
  signal,
}: AbortableStreamOptions<TChunk>): ReadableStream<TChunk> {
  let reader: ReadableStreamDefaultReader<TChunk> | null = null;
  return new ReadableStream<TChunk>({
    start(controller) {
      const streamReader = stream.getReader();
      reader = streamReader;
      let isDone = false;

      const closeController = () => {
        if (isDone) {
          return;
        }
        isDone = true;
        controller.close();
      };

      const abort = () => {
        void streamReader.cancel().catch(() => undefined);
        closeController();
      };

      if (signal.aborted) {
        abort();
        return;
      }

      signal.addEventListener("abort", abort, { once: true });

      const pump = async () => {
        try {
          while (!signal.aborted) {
            const { done, value } = await streamReader.read();
            if (done || signal.aborted) {
              break;
            }
            controller.enqueue(value);
          }
          closeController();
        } catch (error) {
          if (signal.aborted) {
            closeController();
            return;
          }
          isDone = true;
          controller.error(error);
        } finally {
          signal.removeEventListener("abort", abort);
        }
      };

      void pump();
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}

/**
 * Phoenix-specific AI SDK transport that closes the browser-side stream on
 * abort instead of relying on the server to stop producing immediately.
 */
export class PhoenixAgentChatTransport<
  UI_MESSAGE extends UIMessage,
> extends DefaultChatTransport<UI_MESSAGE> {
  override async sendMessages(
    options: Parameters<DefaultChatTransport<UI_MESSAGE>["sendMessages"]>[0]
  ): Promise<ReadableStream<UIMessageChunk>> {
    const stream = await super.sendMessages(options);
    if (!options.abortSignal) {
      return stream;
    }
    return closeStreamOnAbort({
      stream,
      signal: options.abortSignal,
    });
  }
}
