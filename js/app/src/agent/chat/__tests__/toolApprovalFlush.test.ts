import { flushToolApprovals } from "@phoenix/agent/chat/toolApprovalFlush";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

const FLUSH_URL = "/v1/agent_sessions/session-1/tool_approvals";

const SERVER_CALL_METADATA = {
  phoenix: { toolExecutionEnvironment: "server" },
};

function approvalRequestedPart(toolCallId: string) {
  return {
    type: "tool-bash",
    toolCallId,
    state: "approval-requested",
    input: { command: "phoenix-gql 'mutation { deleteEverything }'" },
    approval: { id: `approval-${toolCallId}` },
    callProviderMetadata: SERVER_CALL_METADATA,
  };
}

function approvalRespondedPart(toolCallId: string, approved: boolean) {
  return {
    ...approvalRequestedPart(toolCallId),
    state: "approval-responded",
    approval: { id: `approval-${toolCallId}`, approved },
  };
}

function interruptedToolPart(toolCallId: string) {
  return {
    type: "tool-bash",
    toolCallId,
    state: "output-available",
    input: {},
    output: "The tool call was interrupted",
    callProviderMetadata: { phoenix: { outcome: "interrupted" } },
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

describe("flushToolApprovals", () => {
  it("posts answered approvals while sibling requests stay unanswered", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    void flushToolApprovals({
      message: assistantMessage([
        approvalRespondedPart("call-1", true),
        approvalRequestedPart("call-2"),
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
    expect(body.toolApprovals).toEqual([
      { toolCallId: "call-1", approved: true },
    ]);
  });

  it("carries a denial as faithfully as an approval", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    void flushToolApprovals({
      message: assistantMessage([
        approvalRespondedPart("call-1", false),
        approvalRequestedPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.toolApprovals).toEqual([
      { toolCallId: "call-1", approved: false },
    ]);
  });

  it("sends only the decision, never the approved tool input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    void flushToolApprovals({
      message: assistantMessage([
        approvalRespondedPart("call-1", true),
        approvalRequestedPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body.toolApprovals[0]).sort()).toEqual([
      "approved",
      "toolCallId",
    ]);
  });

  it("re-posts every answered approval on each call; the endpoint dedupes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    void flushToolApprovals({
      message: assistantMessage([
        approvalRespondedPart("call-1", true),
        approvalRequestedPart("call-2"),
        approvalRequestedPart("call-3"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    void flushToolApprovals({
      message: assistantMessage([
        approvalRespondedPart("call-1", true),
        approvalRespondedPart("call-2", false),
        approvalRequestedPart("call-3"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.toolApprovals).toEqual([
      { toolCallId: "call-1", approved: true },
      { toolCallId: "call-2", approved: false },
    ]);
  });

  it("does not flush when nothing has been answered", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    void flushToolApprovals({
      message: assistantMessage([
        approvalRequestedPart("call-1"),
        approvalRequestedPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not flush a turn the user interrupted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());

    void flushToolApprovals({
      message: assistantMessage([
        approvalRespondedPart("call-1", true),
        interruptedToolPart("call-2"),
      ]),
      flushUrl: FLUSH_URL,
      fetch: fetchMock,
    });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows network failures without surfacing them", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      flushToolApprovals({
        message: assistantMessage([
          approvalRespondedPart("call-1", true),
          approvalRequestedPart("call-2"),
        ]),
        flushUrl: FLUSH_URL,
        fetch: fetchMock,
      })
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
