import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import { flushToolOutputs } from "@phoenix/agent/chat/toolOutputFlush";
import { createTranscriptPersistenceCoordinator } from "@phoenix/agent/chat/transcriptPersistence";
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

  it("skips outputs marked synced and marks flushed outputs in place", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const syncedToolOutputIds = new Set<string>();

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds,
    });
    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        resolvedToolPart("call-2"),
        pendingToolPart("call-3"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(
      secondBody.toolOutputs.map(
        (toolOutput: { toolCallId: string }) => toolOutput.toolCallId
      )
    ).toEqual(["call-2"]);
    expect(syncedToolOutputIds).toEqual(new Set(["call-1", "call-2"]));
  });

  it("does not post at all when every resolved output is already synced", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds: new Set(["call-1"]),
    });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unmarks flushed outputs when the post fails so a retry can re-flush", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(okResponse());
    const syncedToolOutputIds = new Set<string>();
    const message = assistantMessage([
      resolvedToolPart("call-1"),
      pendingToolPart("call-2"),
    ]);

    flushToolOutputs({
      message,
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds,
    });
    await settle();
    expect(syncedToolOutputIds.size).toBe(0);

    flushToolOutputs({
      message,
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(syncedToolOutputIds).toEqual(new Set(["call-1"]));
  });

  it("unmarks flushed outputs on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false } as Response);
    const syncedToolOutputIds = new Set<string>();

    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(syncedToolOutputIds.size).toBe(0);
  });

  it("still retries after a failed flush when the ack does not name the output", async () => {
    // A failed flush unmarks its IDs so a later flush can retry. The
    // transcript-persisted ack used to re-mark them from the client's own copy
    // of the message, cancelling that retry for an output the server never
    // received. The ack now names only what it wrote, so an output it does not
    // name stays flushable.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValue(okResponse());
    const coordinator = createTranscriptPersistenceCoordinator();
    const message = assistantMessage([
      resolvedToolPart("call-1"),
      pendingToolPart("call-2"),
    ]);

    flushToolOutputs({
      message,
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds: coordinator.syncedToolOutputIds,
    });
    await settle();
    expect(coordinator.syncedToolOutputIds.size).toBe(0);

    // The turn persisted without call-1's output, so the ack names nothing.
    // Its output resolved client-side after the server took its snapshot.
    coordinator.acknowledge({ messageId: "assistant-1" });
    coordinator.markToolOutputsPersisted([]);

    flushToolOutputs({
      message,
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds: coordinator.syncedToolOutputIds,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(coordinator.syncedToolOutputIds).toEqual(new Set(["call-1"]));
  });

  it("skips an output the ack named as persisted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    const coordinator = createTranscriptPersistenceCoordinator();

    coordinator.markToolOutputsPersisted(["call-1"]);
    flushToolOutputs({
      message: assistantMessage([
        resolvedToolPart("call-1"),
        pendingToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
      syncedToolOutputIds: coordinator.syncedToolOutputIds,
    });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
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
