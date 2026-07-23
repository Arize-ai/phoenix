import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createAddPromptInstanceClientAction,
  createClonePromptInstanceClientAction,
  createEditPromptClientAction,
  createReadPromptClientAction,
  createRemovePromptInstanceClientAction,
  EDIT_PROMPT_TOOL_NAME,
  parseRemovePromptInstanceOutput,
  REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
  type PromptSnapshot,
} from "@phoenix/agent/tools/playgroundPrompt";
import { createAgentStore } from "@phoenix/store/agentStore";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
  type Tool,
} from "@phoenix/store/playground";

installTestStorage();

const functionTool = (id: number, name: string): Tool => ({
  kind: "function",
  id,
  editorType: "json",
  definition: { name },
});

function getFirstToolOutput(addToolOutput: ReturnType<typeof vi.fn>) {
  return addToolOutput.mock.calls[0]?.[0].output;
}

describe("playground prompt agent tools", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
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
    const snapshot: PromptSnapshot = JSON.parse(result.output ?? "");
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
    const original: PromptSnapshot = JSON.parse(readResult.output ?? "");

    const cloneResult = await cloneAction({ instanceId: original.instanceId });

    expect(cloneResult.ok).toBe(true);
    if (!cloneResult.ok) return;
    const cloneOutput: {
      sourceInstanceId: number;
      sourceLabel: string;
      clonedInstanceId: number;
      clonedLabel: string;
      revision: string;
    } = JSON.parse(cloneResult.output ?? "");
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
    const cloned: PromptSnapshot = JSON.parse(clonedRead.output ?? "");
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

  it("adds a default prompt instance with inherited runnable config", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().updateInstance({
      instanceId: 0,
      patch: {
        model: {
          ...playgroundStore.getState().instances[0]!.model,
          modelName: "configured-model",
        },
        tools: [functionTool(7, "lookup_account")],
        toolChoice: {
          type: "SPECIFIC_FUNCTION",
          functionName: "lookup_account",
        },
      },
      dirty: false,
    });
    const addAction = createAddPromptInstanceClientAction({ playgroundStore });

    const addResult = await addAction({});

    expect(addResult.ok).toBe(true);
    if (!addResult.ok) return;
    const addOutput: {
      status: "added";
      addedInstance: PromptSnapshot;
    } = JSON.parse(addResult.output ?? "");
    expect(addOutput.status).toBe("added");
    expect(addOutput.addedInstance.label).toBe("B");
    expect(addOutput.addedInstance.revision).toMatch(/^prompt-/);
    expect(playgroundStore.getState().instances).toHaveLength(2);
    const addedInstance = playgroundStore
      .getState()
      .instances.find(
        (instance) => instance.id === addOutput.addedInstance.instanceId
      );
    expect(addedInstance?.model.modelName).toBe("configured-model");
    expect(addedInstance?.tools).toEqual([functionTool(7, "lookup_account")]);
    expect(addedInstance?.toolChoice).toEqual({
      type: "SPECIFIC_FUNCTION",
      functionName: "lookup_account",
    });
    expect(addedInstance?.prompt).toBeNull();
    expect(addOutput.addedInstance.prompt).toBeNull();
    expect(addOutput.addedInstance.messages).toEqual([
      expect.objectContaining({ role: "system", content: "You are a chatbot" }),
      expect.objectContaining({ role: "user", content: "{{question}}" }),
    ]);
  });

  it("rejects add_prompt_instance when the playground already has four instances", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const addAction = createAddPromptInstanceClientAction({ playgroundStore });
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();

    const result = await addAction({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("at most 4"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(4);
  });

  it("rejects add_prompt_instance while playground instances are running", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const addAction = createAddPromptInstanceClientAction({ playgroundStore });
    playgroundStore.getState().runPlaygroundInstances();

    const result = await addAction({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("while the playground is running"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(1);
  });

  it("rejects remove_prompt_instance for missing, unknown, and last instances", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const agentStore = createAgentStore();
    const removeAction = createRemovePromptInstanceClientAction({
      playgroundStore,
      setPendingPromptInstanceRemoval:
        agentStore.getState().setPendingPromptInstanceRemoval,
    });
    const addToolOutput = vi.fn();

    await expect(
      removeAction({}, { toolCallId: "tc", sessionId: "s", addToolOutput })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid remove_prompt_instance input.",
      })
    );
    await expect(
      removeAction(
        { instanceId: 999 },
        { toolCallId: "tc", sessionId: "s", addToolOutput }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("at least one instance"),
      })
    );
    playgroundStore.getState().addInstance();
    await expect(
      removeAction(
        { instanceId: 999 },
        { toolCallId: "tc", sessionId: "s", addToolOutput }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("was not found"),
      })
    );
  });

  it("queues remove_prompt_instance until the user accepts", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const agentStore = createAgentStore();
    const removeAction = createRemovePromptInstanceClientAction({
      playgroundStore,
      setPendingPromptInstanceRemoval:
        agentStore.getState().setPendingPromptInstanceRemoval,
    });
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const instanceId = playgroundStore.getState().instances[1]!.id;

    const result = await removeAction(
      { instanceId },
      { toolCallId: "tool-call-remove", sessionId: "session-1", addToolOutput }
    );

    expect(result.ok).toBe(true);
    expect(addToolOutput).not.toHaveBeenCalled();
    const pendingRemoval =
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-remove"
      ];
    expect(pendingRemoval).toBeDefined();

    await pendingRemoval!.accept!();

    expect(
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-remove"
      ]
    ).toBeUndefined();
    expect(playgroundStore.getState().instances).toHaveLength(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: "tool-call-remove",
        output: expect.objectContaining({
          status: "removed",
          instanceId,
          label: "B",
          acceptedBy: "user",
        }),
      })
    );
    expect(
      parseRemovePromptInstanceOutput(getFirstToolOutput(addToolOutput))
    ).toEqual(
      expect.objectContaining({
        status: "removed",
        instanceId,
        label: "B",
        acceptedBy: "user",
        message: "Prompt instance removed.",
      })
    );
  });

  it("preserves the instance when remove_prompt_instance is rejected", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const agentStore = createAgentStore();
    const removeAction = createRemovePromptInstanceClientAction({
      playgroundStore,
      setPendingPromptInstanceRemoval:
        agentStore.getState().setPendingPromptInstanceRemoval,
    });
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const instanceId = playgroundStore.getState().instances[1]!.id;

    await removeAction(
      { instanceId },
      { toolCallId: "tool-call-reject", sessionId: "session-1", addToolOutput }
    );
    const pendingRemoval =
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-reject"
      ];
    expect(pendingRemoval).toBeDefined();

    await pendingRemoval!.reject!();

    expect(playgroundStore.getState().instances).toHaveLength(2);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: "tool-call-reject",
        output: expect.objectContaining({
          status: "rejected",
          instanceId,
          label: "B",
        }),
      })
    );
    expect(
      parseRemovePromptInstanceOutput(getFirstToolOutput(addToolOutput))
    ).toEqual(
      expect.objectContaining({
        status: "rejected",
        instanceId,
        label: "B",
        message: "User rejected the prompt instance removal.",
      })
    );
  });

  it("auto-removes prompt instances when edit approvals are bypassed", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const agentStore = createAgentStore();
    const removeAction = createRemovePromptInstanceClientAction({
      playgroundStore,
      setPendingPromptInstanceRemoval:
        agentStore.getState().setPendingPromptInstanceRemoval,
      shouldAutoAccept: () => true,
    });
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const instanceId = playgroundStore.getState().instances[1]!.id;

    const result = await removeAction(
      { instanceId },
      { toolCallId: "tool-call-auto", sessionId: "session-1", addToolOutput }
    );

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().instances).toHaveLength(1);
    expect(
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-auto"
      ]
    ).toBeUndefined();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: "tool-call-auto",
        output: expect.objectContaining({
          status: "removed",
          acceptedBy: "auto",
        }),
      })
    );
    expect(
      parseRemovePromptInstanceOutput(getFirstToolOutput(addToolOutput))
    ).toEqual(
      expect.objectContaining({
        status: "removed",
        instanceId,
        label: "B",
        acceptedBy: "auto",
        message: "Prompt instance removal auto-approved.",
      })
    );
  });

  it("fails stale remove_prompt_instance approvals when the instance can no longer be removed", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const agentStore = createAgentStore();
    const removeAction = createRemovePromptInstanceClientAction({
      playgroundStore,
      setPendingPromptInstanceRemoval:
        agentStore.getState().setPendingPromptInstanceRemoval,
    });
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const instanceId = playgroundStore.getState().instances[1]!.id;

    await removeAction(
      { instanceId },
      { toolCallId: "tool-call-stale", sessionId: "session-1", addToolOutput }
    );
    const pendingRemoval =
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-stale"
      ];
    playgroundStore.getState().deleteInstance(instanceId);

    await pendingRemoval!.accept!();

    expect(playgroundStore.getState().instances).toHaveLength(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: "tool-call-stale",
        errorText: expect.stringContaining("at least one instance"),
      })
    );
  });

  it("cancels a pending remove_prompt_instance approval when the playground becomes unavailable", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const agentStore = createAgentStore();
    const removeAction = createRemovePromptInstanceClientAction({
      playgroundStore,
      setPendingPromptInstanceRemoval:
        agentStore.getState().setPendingPromptInstanceRemoval,
    });
    let resolveToolOutput: (() => void) | undefined;
    const toolOutputPromise = new Promise<void>((resolve) => {
      resolveToolOutput = resolve;
    });
    const addToolOutput = vi.fn().mockReturnValue(toolOutputPromise);
    const instanceId = playgroundStore.getState().instances[1]!.id;

    const result = await removeAction(
      { instanceId },
      {
        toolCallId: "tool-call-remove-cancel",
        sessionId: "session-1",
        addToolOutput,
      }
    );

    expect(result.ok).toBe(true);
    const pendingRemoval =
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-remove-cancel"
      ];
    expect(pendingRemoval).toBeDefined();

    const cancelPromise = pendingRemoval!.cancel!();

    expect(
      agentStore.getState().pendingPromptInstanceRemovalsByToolCallId[
        "tool-call-remove-cancel"
      ]
    ).toBeUndefined();
    expect(playgroundStore.getState().instances).toHaveLength(2);
    resolveToolOutput?.();
    await cancelPromise;

    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: REMOVE_PROMPT_INSTANCE_TOOL_NAME,
        toolCallId: "tool-call-remove-cancel",
        errorText: REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR,
      })
    );
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
    const snapshot: PromptSnapshot = JSON.parse(readResult.output ?? "");
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
    const snapshot: PromptSnapshot = JSON.parse(readResult.output ?? "");
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
    const snapshot: PromptSnapshot = JSON.parse(readResult.output ?? "");
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
    const snapshot: PromptSnapshot = JSON.parse(readResult.output ?? "");

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
