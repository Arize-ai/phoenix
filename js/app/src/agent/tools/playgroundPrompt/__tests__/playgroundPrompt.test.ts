import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type {
  EvaluatorTaskAgentHost,
  EvaluatorTaskRead,
} from "@phoenix/agent/tools/playgroundEvaluator/types";
import {
  createAddPromptInstanceClientAction,
  createClonePromptInstanceClientAction,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

function createStore() {
  return createPlaygroundStore({ datasetId: null, modelConfigByProvider: {} });
}

/** A fake evaluator adapter whose read names the instance it stands for. */
function createFakeHost(instanceId: number): EvaluatorTaskAgentHost {
  const read = { instanceId, kind: "LLM" } as EvaluatorTaskRead;
  return {
    read: () => read,
    edit: () => ({ ok: true, output: read }),
    save: async () => ({ ok: true }),
  };
}

const waitForFakeHost = vi.fn(async (instanceId: number) =>
  createFakeHost(instanceId)
);

describe("playground prompt agent tools", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
    _resetInstanceId();
    _resetMessageId();
    waitForFakeHost.mockClear();
  });

  it("rejects clone_prompt_instance when the playground already has four instances", async () => {
    const playgroundStore = createStore();
    const cloneAction = createClonePromptInstanceClientAction({
      playgroundStore,
    });
    playgroundStore.getState().addInstance({ type: "duplicate" });
    playgroundStore.getState().addInstance({ type: "duplicate" });
    playgroundStore.getState().addInstance({ type: "duplicate" });
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

  it("rejects playground.instance.add when the playground already has four instances", async () => {
    const playgroundStore = createStore();
    const addAction = createAddPromptInstanceClientAction({
      playgroundStore,
      waitForEvaluatorHost: waitForFakeHost,
    });
    playgroundStore.getState().addInstance({ type: "duplicate" });
    playgroundStore.getState().addInstance({ type: "duplicate" });
    playgroundStore.getState().addInstance({ type: "duplicate" });

    const result = await addAction({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("at most 4"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(4);
  });

  it("rejects playground.instance.add while playground instances are running", async () => {
    const playgroundStore = createStore();
    const addAction = createAddPromptInstanceClientAction({
      playgroundStore,
      waitForEvaluatorHost: waitForFakeHost,
    });
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

  it("adds a new prompt task by default on a prompt page and returns its snapshot", async () => {
    const playgroundStore = createStore();
    const addAction = createAddPromptInstanceClientAction({
      playgroundStore,
      waitForEvaluatorHost: waitForFakeHost,
    });

    const result = await addAction(undefined);

    const [, added] = playgroundStore.getState().instances;
    expect(added.task).toEqual({ kind: "prompt" });
    expect(result).toMatchObject({
      ok: true,
      output: {
        status: "added",
        addedInstance: { instanceId: added.id, label: "B", prompt: null },
      },
    });
    expect(waitForFakeHost).not.toHaveBeenCalled();
  });

  it("adds a new LLM evaluator by default on an evaluator page and awaits its editor", async () => {
    const playgroundStore = createStore();
    const [prompt] = playgroundStore.getState().instances;
    playgroundStore.getState().replaceInstance({
      instanceId: prompt.id,
      source: { type: "new", kind: "CODE" },
    });
    const addAction = createAddPromptInstanceClientAction({
      playgroundStore,
      waitForEvaluatorHost: waitForFakeHost,
    });

    const result = await addAction({});

    const [, added] = playgroundStore.getState().instances;
    expect(added.task).toMatchObject({
      kind: "evaluator",
      evaluator: { kind: "LLM" },
    });
    expect(waitForFakeHost).toHaveBeenCalledWith(added.id, expect.any(Number));
    expect(result).toMatchObject({
      ok: true,
      output: {
        status: "added",
        addedInstance: { instanceId: added.id, kind: "LLM" },
        message: expect.stringContaining("LLM evaluator"),
      },
    });
  });

  it("rejects a source of the other kind than the page's", async () => {
    const playgroundStore = createStore();
    const addAction = createAddPromptInstanceClientAction({
      playgroundStore,
      waitForEvaluatorHost: waitForFakeHost,
    });

    const result = await addAction({ source: { type: "new", kind: "CODE" } });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("prompt task"),
    });
    expect(playgroundStore.getState().instances).toHaveLength(1);
  });

  it("duplicates the first instance when asked", async () => {
    const playgroundStore = createStore();
    const addAction = createAddPromptInstanceClientAction({
      playgroundStore,
      waitForEvaluatorHost: waitForFakeHost,
    });

    const result = await addAction({ source: { type: "duplicate" } });

    expect(playgroundStore.getState().instances).toHaveLength(2);
    expect(result).toMatchObject({
      ok: true,
      output: { message: expect.stringContaining("Duplicate") },
    });
  });
});
