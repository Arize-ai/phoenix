import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type {
  EvaluatorTaskAgentHost,
  EvaluatorTaskRead,
} from "@phoenix/agent/tools/playgroundEvaluator/types";
import { TASK_MENU_LOCK_NOTE } from "@phoenix/pages/playground/TaskMenu/taskMenuItems";
import type { PlaygroundStore } from "@phoenix/store/playground";
import {
  _resetInstanceId,
  _resetMessageId,
  createNormalizedPlaygroundInstance,
  createPlaygroundStore,
} from "@phoenix/store/playground";

import { createSelectTaskClientAction } from "../clientActions";
import { hasInstanceLoaded, waitForInstanceLoad } from "../instanceLoad";
import { selectTaskInputSchema } from "../schemas";

installTestStorage();

function createStore() {
  return createPlaygroundStore({ datasetId: null, modelConfigByProvider: {} });
}

/** A fake evaluator adapter whose read names the instance it stands for. */
function createFakeHost(instanceId: number): EvaluatorTaskAgentHost {
  const read = { instanceId, kind: "CODE", name: "fake" } as EvaluatorTaskRead;
  return {
    read: () => read,
    edit: () => ({ ok: true, output: read }),
    save: async () => ({ ok: true }),
  };
}

/** Lands a prompt in the instance the way the page's loader does. */
function landPrompt(
  playgroundStore: PlaygroundStore,
  instanceId: number,
  prompt: { id: string; version: string }
) {
  const { instance: defaults } = createNormalizedPlaygroundInstance();
  playgroundStore.getState().loadInstance({
    instanceId,
    instance: {
      ...defaults,
      template: {
        __type: "chat",
        messages: [{ id: 900, role: "user", content: "{{input}}" }],
      },
      prompt: { ...prompt, name: "judge", tag: null },
    },
  });
}

describe("playground.task.select", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("loads another prompt into a prompt task in place and returns its snapshot", async () => {
    const playgroundStore = createStore();
    const [instance] = playgroundStore.getState().instances;
    const waitForEvaluatorHost = vi.fn();
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost,
    });

    const pending = select({
      source: { type: "prompt", promptId: "P1", promptVersionId: "V1" },
      discardChanges: false,
    });
    // The handler set the loading source synchronously; the page's loader
    // would now fetch the prompt.
    expect(playgroundStore.getState().instances[0].loadingSource).toEqual({
      type: "prompt",
      promptId: "P1",
      promptVersionId: "V1",
    });
    landPrompt(playgroundStore, instance.id, { id: "P1", version: "V1" });

    const result = await pending;
    expect(result).toMatchObject({
      ok: true,
      output: { instanceId: instance.id, prompt: { id: "P1", version: "V1" } },
    });
    expect(playgroundStore.getState().instances).toHaveLength(1);
    expect(waitForEvaluatorHost).not.toHaveBeenCalled();
  });

  it("replaces the instance for a kind change and awaits the evaluator editor", async () => {
    const playgroundStore = createStore();
    const [instance] = playgroundStore.getState().instances;
    const waitForEvaluatorHost = vi.fn(async (instanceId: number) =>
      createFakeHost(instanceId)
    );
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost,
    });

    const result = await select({
      source: { type: "new", kind: "CODE" },
      discardChanges: false,
    });

    const [replacement] = playgroundStore.getState().instances;
    expect(replacement.id).not.toBe(instance.id);
    expect(replacement.task).toMatchObject({
      kind: "evaluator",
      evaluator: { kind: "CODE" },
    });
    expect(waitForEvaluatorHost).toHaveBeenCalledWith(
      replacement.id,
      expect.any(Number)
    );
    expect(result).toMatchObject({
      ok: true,
      output: { instanceId: replacement.id, kind: "CODE" },
    });
  });

  it("rejects a source of the other kind once the page's kind is locked", async () => {
    const playgroundStore = createStore();
    playgroundStore.getState().addInstance({ type: "duplicate" });
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost: vi.fn(),
    });

    const result = await select({
      instanceId: playgroundStore.getState().instances[1].id,
      source: { type: "new", kind: "LLM" },
      discardChanges: true,
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining(TASK_MENU_LOCK_NOTE),
    });
    expect(
      playgroundStore
        .getState()
        .instances.every((i) => i.task.kind === "prompt")
    ).toBe(true);
  });

  it("requires discardChanges to replace a task with unsaved changes", async () => {
    const playgroundStore = createStore();
    const [instance] = playgroundStore.getState().instances;
    playgroundStore.getState().setDirty(instance.id, true);
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost: vi.fn(async (id: number) => createFakeHost(id)),
    });

    expect(
      await select({
        source: { type: "new", kind: "LLM" },
        discardChanges: false,
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("discardChanges"),
    });
    expect(playgroundStore.getState().instances[0].id).toBe(instance.id);

    expect(
      await select({
        source: { type: "new", kind: "LLM" },
        discardChanges: true,
      })
    ).toMatchObject({ ok: true });
    expect(playgroundStore.getState().instances[0].task.kind).toBe("evaluator");
  });

  it("rejects a change while a run is active", async () => {
    const playgroundStore = createStore();
    playgroundStore.getState().runPlaygroundInstances();
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost: vi.fn(),
    });

    expect(
      await select({
        source: { type: "new", kind: "CODE" },
        discardChanges: false,
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining("running") });
  });

  it("reports NOT_FOUND when the load ends without landing the source", async () => {
    const playgroundStore = createStore();
    const [instance] = playgroundStore.getState().instances;
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost: vi.fn(),
    });

    const pending = select({
      source: { type: "prompt", promptId: "gone" },
      discardChanges: false,
    });
    // What the loader does when the fetch fails.
    playgroundStore.getState().updateInstance({
      instanceId: instance.id,
      patch: { loadingSource: null },
      dirty: null,
    });

    expect(await pending).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      error: expect.stringContaining("gone"),
    });
  });

  it("lists the instance ids when several instances exist and none is named", async () => {
    const playgroundStore = createStore();
    playgroundStore.getState().addInstance({ type: "duplicate" });
    const select = createSelectTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost: vi.fn(),
    });

    expect(
      await select({
        source: { type: "new", kind: "prompt" },
        discardChanges: false,
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Pass one of these instance IDs"),
    });
  });
});

describe("instance load helpers", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("resolves at once for an instance that is not loading", async () => {
    const playgroundStore = createStore();
    const [instance] = playgroundStore.getState().instances;
    await expect(
      waitForInstanceLoad(playgroundStore, instance.id, 50)
    ).resolves.toBe(true);
  });

  it("resolves false when the load outlasts the timeout", async () => {
    vi.useFakeTimers();
    try {
      const playgroundStore = createStore();
      const instanceId = playgroundStore
        .getState()
        .addInstance({ type: "prompt", promptId: "P1" });
      const pending = waitForInstanceLoad(playgroundStore, instanceId!, 50);
      vi.advanceTimersByTime(50);
      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells a landed source from one that did not load", () => {
    const playgroundStore = createStore();
    const instanceId = playgroundStore
      .getState()
      .addInstance({ type: "evaluator", evaluatorId: "E1" })!;
    // The draft names the evaluator before the fetch; only the loader's
    // failure path clears it, so the check is meaningful after the wait.
    const draft = playgroundStore.getState().instances[1];
    expect(
      hasInstanceLoaded(draft, { type: "evaluator", evaluatorId: "E1" })
    ).toBe(true);
    expect(
      hasInstanceLoaded(draft, {
        type: "datasetEvaluator",
        datasetEvaluatorId: "DE1",
      })
    ).toBe(false);
    expect(hasInstanceLoaded(draft, { type: "new", kind: "CODE" })).toBe(true);

    const promptInstance = playgroundStore.getState().instances[0];
    expect(
      hasInstanceLoaded(promptInstance, { type: "prompt", promptId: "P1" })
    ).toBe(false);
    landPrompt(playgroundStore, instanceId, { id: "P1", version: "V2" });
    const loaded = playgroundStore.getState().instances[1];
    expect(hasInstanceLoaded(loaded, { type: "prompt", promptId: "P1" })).toBe(
      true
    );
    expect(
      hasInstanceLoaded(loaded, {
        type: "prompt",
        promptId: "P1",
        promptVersionId: "V1",
      })
    ).toBe(false);
  });
});

describe("selectTaskInputSchema", () => {
  it("accepts every task source and rejects unknown ones", () => {
    expect(
      selectTaskInputSchema.safeParse({
        source: { type: "evaluator", evaluatorId: "E1" },
      }).data
    ).toEqual({
      source: { type: "evaluator", evaluatorId: "E1" },
      discardChanges: false,
    });
    expect(
      selectTaskInputSchema.safeParse({
        source: { type: "duplicate" },
      }).success
    ).toBe(false);
    expect(
      selectTaskInputSchema.safeParse({
        source: { type: "new", kind: "CODE" },
        slot: "A",
      }).success
    ).toBe(false);
  });
});
