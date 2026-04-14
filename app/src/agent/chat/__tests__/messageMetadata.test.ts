import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";

import {
  pxiMessageMetadataSchema,
  type PxiUIMessage,
} from "../messageMetadata";

function createChunkStream(chunks: UIMessageChunk[]) {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe("pxiMessageMetadata", () => {
  it("attaches streamed trace metadata to the assistant message", async () => {
    const transport: ChatTransport<PxiUIMessage> = {
      sendMessages: async () =>
        createChunkStream([
          {
            type: "start",
            messageMetadata: {
              traceId: "0123456789abcdef0123456789abcdef",
              rootSpanId: "0123456789abcdef",
              sessionId: "session-1",
            },
          },
          { type: "start-step" },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Hello from PXI" },
          { type: "text-end", id: "text-1" },
          { type: "finish-step" },
          { type: "finish", finishReason: "stop" },
        ]),
      reconnectToStream: async () => null,
    };

    const chat = new Chat<PxiUIMessage>({
      id: "session-1",
      transport,
      messageMetadataSchema: pxiMessageMetadataSchema,
    });

    await chat.sendMessage({ text: "Hi" });

    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[1]).toMatchObject({
      role: "assistant",
      metadata: {
        traceId: "0123456789abcdef0123456789abcdef",
        rootSpanId: "0123456789abcdef",
        sessionId: "session-1",
      },
    });
  });
});
