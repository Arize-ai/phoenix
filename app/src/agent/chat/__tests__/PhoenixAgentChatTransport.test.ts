import type { UIMessageChunk } from "ai";

import { closeStreamOnAbort } from "@phoenix/agent/chat/PhoenixAgentChatTransport";

function createTextStartChunk(id: string): UIMessageChunk {
  return { type: "text-start", id };
}

describe("closeStreamOnAbort", () => {
  it("cancels the source stream and closes the wrapped stream on abort", async () => {
    let sourceController: ReadableStreamDefaultController<UIMessageChunk>;
    let isSourceCancelled = false;
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        sourceController = controller;
      },
      cancel() {
        isSourceCancelled = true;
      },
    });
    const abortController = new AbortController();
    const stream = closeStreamOnAbort({
      stream: source,
      signal: abortController.signal,
    });
    const reader = stream.getReader();

    sourceController!.enqueue(createTextStartChunk("part-1"));
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: createTextStartChunk("part-1"),
    });

    abortController.abort();
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(isSourceCancelled).toBe(true);
  });

  it("closes immediately when the signal is already aborted", async () => {
    let isSourceCancelled = false;
    const source = new ReadableStream<UIMessageChunk>({
      cancel() {
        isSourceCancelled = true;
      },
    });
    const abortController = new AbortController();
    abortController.abort();

    const stream = closeStreamOnAbort({
      stream: source,
      signal: abortController.signal,
    });
    const reader = stream.getReader();

    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(isSourceCancelled).toBe(true);
  });
});
