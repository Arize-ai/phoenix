import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import { createToolOutputFlusher } from "@phoenix/agent/chat/toolOutputFlush";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

const FLUSH_URL = "/v1/agents/assistant/sessions/session-1/tool_outputs";

const CLIENT_CALL_METADATA = {
  phoenix: {
    toolExecutionEnvironment: "client",
    toolInputEmittedAt: "2026-08-05T20:35:35+00:00",
  },
};

function pendingToolPart(toolCallId: string) {
  return {
    type: "tool-edit_prompt_instance",
    toolCallId,
    state: "input-available",
    input: {},
    callProviderMetadata: CLIENT_CALL_METADATA,
  };
}

function resolvedToolPart(toolCallId: string) {
  return {
    type: "tool-edit_prompt_instance",
    toolCallId,
    state: "output-available",
    input: {},
    output: { applied: true },
    callProviderMetadata: CLIENT_CALL_METADATA,
  };
}

function assistantMessage(
  parts: Array<Record<string, unknown>>
): AgentUIMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts,
  } as unknown as AgentUIMessage;
}

function userMessage(): AgentUIMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "edit the prompt" }],
  } as unknown as AgentUIMessage;
}

function okResponse(): Response {
  return { ok: true } as Response;
}

function errorResponse(): Response {
  return { ok: false } as Response;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("createToolOutputFlusher", () => {
  it("posts newly resolved outputs while sibling calls stay pending", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    flusher.maybeFlush([
      userMessage(),
      assistantMessage([resolvedToolPart("call-1"), pendingToolPart("call-2")]),
    ]);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(FLUSH_URL);
    const body = JSON.parse(init.body);
    expect(body.lastMessageId).toBe("assistant-1");
    expect(body.toolOutputs).toHaveLength(1);
    expect(body.toolOutputs[0].toolCallId).toBe("call-1");
  });

  it("does not repost outputs the server already persisted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    const messages = [
      userMessage(),
      assistantMessage([resolvedToolPart("call-1"), pendingToolPart("call-2")]),
    ];

    flusher.maybeFlush(messages);
    await settle();
    flusher.maybeFlush(messages);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flushes the final output once every tool call has resolved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    // The bare chat continuation carries no outputs, so even a fully
    // resolved tail must flush.
    flusher.maybeFlush([
      userMessage(),
      assistantMessage([
        resolvedToolPart("call-1"),
        resolvedToolPart("call-2"),
      ]),
    ]);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.toolOutputs).toHaveLength(2);
  });

  it("flushAndWait resolves true once every output has landed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    const flushed = await flusher.flushAndWait([
      userMessage(),
      assistantMessage([
        resolvedToolPart("call-1"),
        resolvedToolPart("call-2"),
      ]),
    ]);

    expect(flushed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flushAndWait retries a failed pass once before giving up", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    const flushed = await flusher.flushAndWait([
      userMessage(),
      assistantMessage([resolvedToolPart("call-1")]),
    ]);

    expect(flushed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flushAndWait resolves false when outputs cannot land", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    const flushed = await flusher.flushAndWait([
      userMessage(),
      assistantMessage([resolvedToolPart("call-1")]),
    ]);

    expect(flushed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flushAndWait is a no-op when nothing needs flushing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    const flushed = await flusher.flushAndWait([userMessage()]);

    expect(flushed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves outputs eligible for retry after a failed flush", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    const messages = [
      userMessage(),
      assistantMessage([resolvedToolPart("call-1"), pendingToolPart("call-2")]),
    ];

    flusher.maybeFlush(messages);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    flusher.maybeFlush(messages);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retryBody.toolOutputs[0].toolCallId).toBe("call-1");
  });

  it("swallows network failures without surfacing them", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    flusher.maybeFlush([
      userMessage(),
      assistantMessage([resolvedToolPart("call-1"), pendingToolPart("call-2")]),
    ]);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serializes flushes and picks up outputs resolved mid-flight", async () => {
    let releaseFirstRequest: (response: Response) => void = () => {};
    const firstRequest = new Promise<Response>((resolve) => {
      releaseFirstRequest = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });

    flusher.maybeFlush([
      userMessage(),
      assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
        pendingToolPart("call-3"),
      ]),
    ]);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A second output resolves while the first request is still in flight.
    flusher.maybeFlush([
      userMessage(),
      assistantMessage([
        resolvedToolPart("call-1"),
        resolvedToolPart("call-2"),
        pendingToolPart("call-3"),
      ]),
    ]);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFirstRequest(okResponse());
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.toolOutputs).toHaveLength(1);
    expect(secondBody.toolOutputs[0].toolCallId).toBe("call-2");
  });

  it("flushes previously persisted outputs again after clear", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    const messages = [
      userMessage(),
      assistantMessage([resolvedToolPart("call-1"), pendingToolPart("call-2")]),
    ];

    flusher.maybeFlush(messages);
    await settle();
    flusher.clear();
    flusher.maybeFlush(messages);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("attaches recorded client timings to the flushed outputs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const toolTimings = createClientToolTimingRecorder({
      getCurrentTime: () => new Date("2026-08-05T20:36:00Z"),
    });
    toolTimings.recordStart("call-1");
    toolTimings.recordEnd("call-1");
    const flusher = createToolOutputFlusher({
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      toolTimings,
    });

    flusher.maybeFlush([
      userMessage(),
      assistantMessage([resolvedToolPart("call-1"), pendingToolPart("call-2")]),
    ]);
    await settle();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const phoenixMetadata = body.toolOutputs[0].callProviderMetadata.phoenix;
    expect(phoenixMetadata.clientStartedAt).toBe("2026-08-05T20:36:00.000Z");
    expect(phoenixMetadata.clientEndedAt).toBe("2026-08-05T20:36:00.000Z");
  });
});
