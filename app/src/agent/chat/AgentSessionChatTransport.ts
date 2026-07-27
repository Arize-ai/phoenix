import {
  DefaultChatTransport,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import type { SessionEventsBridge } from "./sessionEventsBridge";

type SendMessagesOptions = Parameters<
  ChatTransport<AgentUIMessage>["sendMessages"]
>[0];

/** POST transport whose reconnect path consumes replay windows from the bridge. */
export class AgentSessionChatTransport extends DefaultChatTransport<AgentUIMessage> {
  private readonly eventsBridge: SessionEventsBridge;

  constructor({
    eventsBridge,
    ...options
  }: ConstructorParameters<typeof DefaultChatTransport<AgentUIMessage>>[0] & {
    eventsBridge: SessionEventsBridge;
  }) {
    super(options);
    this.eventsBridge = eventsBridge;
  }

  override async sendMessages(
    options: SendMessagesOptions
  ): Promise<ReadableStream<UIMessageChunk>> {
    const endLocalPost = this.eventsBridge.beginLocalPost();
    try {
      const responseStream = await super.sendMessages(options);
      const reader = responseStream.getReader();
      return new ReadableStream<UIMessageChunk>({
        async pull(controller) {
          try {
            const result = await reader.read();
            if (result.done) {
              endLocalPost();
              controller.close();
              return;
            }
            controller.enqueue(result.value);
          } catch (error) {
            // A user abort must not re-attach to the turn it just stopped;
            // only an unexpected mid-stream failure resumes through the bus.
            const isAbortError =
              error instanceof Error && error.name === "AbortError";
            endLocalPost({ shouldResume: !isAbortError });
            controller.error(error);
          }
        },
        async cancel(reason) {
          endLocalPost();
          await reader.cancel(reason);
        },
      });
    } catch (error) {
      // The POST failed before a stream existed (e.g. 409 busy), so no turn
      // was claimed by this client.
      endLocalPost({ wasTurnClaimed: false });
      throw error;
    }
  }

  override async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return this.eventsBridge.getReconnectStream();
  }
}
