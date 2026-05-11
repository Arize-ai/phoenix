import {
  createClonePromptInstanceClientAction,
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
    expect(snapshot.label).toBe("A");
    expect(snapshot.revision).toMatch(/^prompt-/);
    expect(snapshot.messages).toEqual([
      expect.objectContaining({ id: 0, role: "system" }),
      expect.objectContaining({ id: 1, role: "user" }),
    ]);
  });

  it("clones a prompt instance for comparison with fresh message IDs", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const readAction = createReadPromptClientAction({ playgroundStore });
    const cloneAction = createClonePromptInstanceClientAction({
      playgroundStore,
    });
    const readResult = await readAction({});
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    const original = JSON.parse(readResult.output ?? "") as PromptSnapshot;

    const cloneResult = await cloneAction({ instanceId: original.instanceId });

    expect(cloneResult.ok).toBe(true);
    if (!cloneResult.ok) return;
    const cloneOutput = JSON.parse(cloneResult.output ?? "") as {
      sourceInstanceId: number;
      sourceLabel: string;
      clonedInstanceId: number;
      clonedLabel: string;
      revision: string;
    };
    expect(cloneOutput.sourceInstanceId).toBe(original.instanceId);
    expect(cloneOutput.sourceLabel).toBe("A");
    expect(cloneOutput.clonedInstanceId).not.toBe(original.instanceId);
    expect(cloneOutput.clonedLabel).toBe("B");
    expect(playgroundStore.getState().instances).toHaveLength(2);
    const clonedRead = await readAction({
      instanceId: cloneOutput.clonedInstanceId,
    });
    expect(clonedRead.ok).toBe(true);
    if (!clonedRead.ok) return;
    const cloned = JSON.parse(clonedRead.output ?? "") as PromptSnapshot;
    expect(cloned.messages.map((message) => message.content)).toEqual(
      original.messages.map((message) => message.content)
    );
    expect(cloned.messages.map((message) => message.id)).not.toEqual(
      original.messages.map((message) => message.id)
    );
  });

  it("rejects clone_prompt_instance when the playground already has four instances", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const cloneAction = createClonePromptInstanceClientAction({
      playgroundStore,
    });
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();
    expect(playgroundStore.getState().instances).toHaveLength(4);

    const result = await cloneAction({ instanceId: 0 });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("at most 4"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(4);
  });

  it("queues edit_prompt_instance until the user accepts, then applies the edit and completes the tool", async () => {
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
    let resolveToolOutput: (() => void) | undefined;
    const toolOutputPromise = new Promise<void>((resolve) => {
      resolveToolOutput = resolve;
    });
    const addToolOutput = vi.fn().mockReturnValue(toolOutputPromise);

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

    const acceptPromise = pendingEdit!.accept!();

    expect(
      agentStore.getState().pendingPromptEditsByToolCallId["tool-call-1"]
    ).toBeUndefined();
    resolveToolOutput?.();
    await acceptPromise;

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
  });

  it("cancels a pending edit when the playground becomes unavailable", async () => {
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
    let resolveToolOutput: (() => void) | undefined;
    const toolOutputPromise = new Promise<void>((resolve) => {
      resolveToolOutput = resolve;
    });
    const addToolOutput = vi.fn().mockReturnValue(toolOutputPromise);

    const editResult = await editAction(
      {
        instanceId: snapshot.instanceId,
        expectedRevision: snapshot.revision,
        operations: [
          {
            type: "update_message",
            messageId: snapshot.messages[1]!.id,
            content: "Pending edit",
          },
        ],
      },
      { toolCallId: "tool-call-cancel", sessionId: "session-1", addToolOutput }
    );

    expect(editResult.ok).toBe(true);
    const pendingEdit =
      agentStore.getState().pendingPromptEditsByToolCallId["tool-call-cancel"];
    expect(pendingEdit).toBeDefined();

    const cancelPromise = pendingEdit!.cancel!();

    expect(
      agentStore.getState().pendingPromptEditsByToolCallId["tool-call-cancel"]
    ).toBeUndefined();
    resolveToolOutput?.();
    await cancelPromise;

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: "tool-call-cancel",
        errorText: expect.stringContaining("playground was closed"),
      })
    );
    expect(
      playgroundStore.getState().allInstanceMessages[snapshot.messages[1]!.id]
        ?.content
    ).not.toBe("Pending edit");
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
        error: expect.stringContaining("prompt has changed"),
      })
    );
  });

  it("parses common near-miss edit_prompt_instance inputs", async () => {
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
