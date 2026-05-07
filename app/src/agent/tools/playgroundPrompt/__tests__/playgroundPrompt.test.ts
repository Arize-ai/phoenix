import {
  createEditPromptClientAction,
  createReadPromptClientAction,
  EDIT_PROMPT_TOOL_NAME,
  type PromptSnapshot,
} from "@phoenix/agent/tools/playgroundPrompt";
import { createAgentStore } from "@phoenix/store/agentStore";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

describe("playground prompt agent tools", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-agent");
    _resetInstanceId();
    _resetMessageId();
  });

  it("reads a compact prompt snapshot with a revision", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createReadPromptClientAction({ playgroundStore });

    const result = await action({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = JSON.parse(result.output ?? "") as PromptSnapshot;
    expect(snapshot.instanceId).toBe(0);
    expect(snapshot.revision).toMatch(/^prompt-/);
    expect(snapshot.messages).toEqual([
      expect.objectContaining({ id: 0, role: "system" }),
      expect.objectContaining({ id: 1, role: "user" }),
    ]);
  });

  it("queues edit_prompt until the user accepts, then applies the edit and completes the tool", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const agentStore = createAgentStore();
    const readAction = createReadPromptClientAction({ playgroundStore });
    const editAction = createEditPromptClientAction({
      playgroundStore,
      setPendingPromptEdit: agentStore.getState().setPendingPromptEdit,
    });
    const readResult = await readAction({});
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    const snapshot = JSON.parse(readResult.output ?? "") as PromptSnapshot;
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    const editResult = await editAction(
      {
        instanceId: snapshot.instanceId,
        expectedRevision: snapshot.revision,
        operations: [
          {
            type: "update_message",
            messageId: snapshot.messages[1]!.id,
            content: "{{question}}\nBe concise.",
          },
        ],
      },
      { toolCallId: "tool-call-1", sessionId: "session-1", addToolOutput }
    );

    expect(editResult.ok).toBe(true);
    expect(addToolOutput).not.toHaveBeenCalled();
    const pendingEdit =
      agentStore.getState().pendingPromptEditsByToolCallId["tool-call-1"];
    expect(pendingEdit).toBeDefined();

    await pendingEdit!.accept!();

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: "tool-call-1",
        output: expect.objectContaining({ status: "accepted" }),
      })
    );
    expect(
      playgroundStore.getState().allInstanceMessages[snapshot.messages[1]!.id]
        ?.content
    ).toBe("{{question}}\nBe concise.");
    expect(
      playgroundStore.getState().externallyUpdatedMessageRevisionById[
        snapshot.messages[1]!.id
      ]
    ).toBe(1);
    expect(
      agentStore.getState().pendingPromptEditsByToolCallId["tool-call-1"]
    ).toBeUndefined();
  });

  it("rejects stale edits", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const agentStore = createAgentStore();
    const readAction = createReadPromptClientAction({ playgroundStore });
    const editAction = createEditPromptClientAction({
      playgroundStore,
      setPendingPromptEdit: agentStore.getState().setPendingPromptEdit,
    });
    const readResult = await readAction({});
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    const snapshot = JSON.parse(readResult.output ?? "") as PromptSnapshot;
    playgroundStore.getState().updateMessage({
      instanceId: snapshot.instanceId,
      messageId: snapshot.messages[1]!.id,
      patch: { content: "User changed this first." },
    });

    const result = await editAction(
      {
        instanceId: snapshot.instanceId,
        expectedRevision: snapshot.revision,
        operations: [
          {
            type: "update_message",
            messageId: snapshot.messages[1]!.id,
            content: "PXI edit",
          },
        ],
      },
      {
        toolCallId: "tool-call-2",
        sessionId: "session-1",
        addToolOutput: vi.fn(),
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("read_prompt"),
      })
    );
  });

  it("parses common near-miss edit_prompt inputs", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const agentStore = createAgentStore();
    const readAction = createReadPromptClientAction({ playgroundStore });
    const editAction = createEditPromptClientAction({
      playgroundStore,
      setPendingPromptEdit: agentStore.getState().setPendingPromptEdit,
    });
    const readResult = await readAction({});
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    const snapshot = JSON.parse(readResult.output ?? "") as PromptSnapshot;

    const result = await editAction(
      {
        instance_id: snapshot.instanceId,
        expected_revision: snapshot.revision,
        operation: {
          type: "update_message",
          message_id: snapshot.messages[1]!.id,
          content: "near miss accepted",
        },
      },
      {
        toolCallId: "tool-call-3",
        sessionId: "session-1",
        addToolOutput: vi.fn(),
      }
    );

    expect(result.ok).toBe(true);
    expect(
      agentStore.getState().pendingPromptEditsByToolCallId["tool-call-3"]
    ).toBeDefined();
  });
});
