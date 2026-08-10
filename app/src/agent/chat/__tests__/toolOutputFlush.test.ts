import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import { flushToolOutputs } from "@phoenix/agent/chat/toolOutputFlush";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

const FLUSH_URL = "/v1/agent_sessions/session-1/tool_outputs";

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

function okResponse(): Response {
  return { ok: true } as Response;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("flushToolOutputs", () => {
  it("posts resolved outputs while sibling calls stay pending", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(FLUSH_URL);
    const body = JSON.parse(init.body);
    expect(body.lastMessageId).toBe("assistant-1");
    expect(body.toolOutputs).toHaveLength(1);
    expect(body.toolOutputs[0].toolCallId).toBe("call-1");
  });

  it("re-posts every resolved output on each call; the endpoint dedupes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        resolvedToolPart("call-2"),
        pendingToolPart("call-3"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(
      secondBody.toolOutputs.map(
        (toolOutput: { toolCallId: string }) => toolOutput.toolCallId
      )
    ).toEqual(["call-1", "call-2"]);
  });

  it("does not flush when every tool call has resolved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        resolvedToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    // The normal chat continuation carries the outputs instead.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows network failures without surfacing them", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("attaches recorded client timings to the flushed outputs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const toolTimings = createClientToolTimingRecorder({
      getCurrentTime: () => new Date("2026-08-05T20:36:00Z"),
    });
    toolTimings.recordStart("call-1");
    toolTimings.recordEnd("call-1");

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      toolTimings,
    });
    await settle();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const phoenixMetadata = body.toolOutputs[0].callProviderMetadata.phoenix;
    expect(phoenixMetadata.clientStartedAt).toBe("2026-08-05T20:36:00.000Z");
    expect(phoenixMetadata.clientEndedAt).toBe("2026-08-05T20:36:00.000Z");
  });
});
