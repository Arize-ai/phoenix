import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

import {
  createEditEvaluatorTaskClientAction,
  createReadEvaluatorTaskClientAction,
  createSaveEvaluatorTaskClientAction,
  createSetExpectedOutputClientAction,
} from "../clientActions";
import { toEvaluatorTaskOutputConfigs } from "../outputConfigs";
import { setExpectedOutputInputSchema } from "../schemas";
import type { EvaluatorTaskAgentHost, EvaluatorTaskRead } from "../types";

installTestStorage();

/** A page holding one CODE evaluator task with a pass/fail output. */
function createEvaluatorPage() {
  const playgroundStore = createPlaygroundStore({
    datasetId: null,
    modelConfigByProvider: {},
  });
  const [prompt] = playgroundStore.getState().instances;
  const instanceId = playgroundStore.getState().replaceInstance({
    instanceId: prompt.id,
    source: { type: "new", kind: "CODE" },
  })!;
  return { playgroundStore, instanceId };
}

function createFakeHost(instanceId: number) {
  const read = {
    instanceId,
    kind: "CODE",
    revision: "r1",
  } as EvaluatorTaskRead;
  const host: EvaluatorTaskAgentHost = {
    read: vi.fn(() => read),
    edit: vi.fn((): UIOperationResult => ({ ok: true, output: read })),
    save: vi.fn(
      async (): Promise<UIOperationResult> => ({
        ok: true,
        output: { datasetEvaluatorId: "DE1", action: "created", name: "q" },
      })
    ),
  };
  return host;
}

describe("playground.evaluator.* handlers", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("reads, edits and saves through the instance's adapter", async () => {
    const { playgroundStore, instanceId } = createEvaluatorPage();
    const host = createFakeHost(instanceId);
    const deps = {
      playgroundStore,
      waitForEvaluatorHost: vi.fn(async () => host),
    };

    expect(await createReadEvaluatorTaskClientAction(deps)({})).toMatchObject({
      ok: true,
      output: { instanceId, kind: "CODE" },
    });
    expect(
      await createEditEvaluatorTaskClientAction(deps)({
        instanceId,
        expectedRevision: "r1",
        name: "quality",
      })
    ).toMatchObject({ ok: true, output: { instanceId } });
    expect(host.edit).toHaveBeenCalledWith({
      expectedRevision: "r1",
      name: "quality",
    });
    expect(
      await createSaveEvaluatorTaskClientAction(deps)({
        instanceId,
        expectedRevision: "r1",
      })
    ).toMatchObject({ ok: true, output: { action: "created" } });
    expect(host.save).toHaveBeenCalledWith("r1", { asNew: false });
  });

  it("points a prompt task at playground.prompt.read", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const waitForEvaluatorHost = vi.fn();
    const result = await createReadEvaluatorTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost,
    })({});

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      error: expect.stringContaining("playground.prompt.read"),
    });
    expect(waitForEvaluatorHost).not.toHaveBeenCalled();
  });

  it("fails when the editor never registers its adapter", async () => {
    const { playgroundStore } = createEvaluatorPage();
    const result = await createReadEvaluatorTaskClientAction({
      playgroundStore,
      waitForEvaluatorHost: vi.fn(async () => null),
    })({});

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("not finished loading"),
    });
  });
});

describe("playground.expectedOutput.set", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  const examples = [{ id: "EX1", revisionId: "REV1" }];

  function createAction(
    playgroundStore: ReturnType<typeof createEvaluatorPage>["playgroundStore"]
  ) {
    const saveNow = vi.fn(
      async (): Promise<UIOperationResult> => ({
        ok: true,
        output: { saved: 1 },
      })
    );
    const action = createSetExpectedOutputClientAction({
      playgroundStore,
      getExamples: () => examples,
      saveNow,
    });
    return { action, saveNow };
  }

  it("writes under the task's annotation name and reports the write", async () => {
    const { playgroundStore, instanceId } = createEvaluatorPage();
    const { action, saveNow } = createAction(playgroundStore);

    const result = await action({
      instanceId,
      exampleId: "EX1",
      expectedRevisionId: "REV1",
      label: "pass",
    });

    // A nameless draft in position A runs as evaluator_1.
    expect(saveNow).toHaveBeenCalledWith("EX1", "evaluator_1", {
      label: "pass",
      score: null,
      explanation: null,
    });
    expect(result).toEqual({
      ok: true,
      output: { exampleId: "EX1", annotationName: "evaluator_1", saved: 1 },
    });
  });

  it("clears the expected output when every field is null", async () => {
    const { playgroundStore, instanceId } = createEvaluatorPage();
    const { action, saveNow } = createAction(playgroundStore);

    await action({
      instanceId,
      exampleId: "EX1",
      expectedRevisionId: "REV1",
      label: null,
    });

    expect(saveNow).toHaveBeenCalledWith("EX1", "evaluator_1", null);
  });

  it("guards the example's revision and the output's labels", async () => {
    const { playgroundStore, instanceId } = createEvaluatorPage();
    const { action, saveNow } = createAction(playgroundStore);

    expect(
      await action({
        instanceId,
        exampleId: "EX1",
        expectedRevisionId: "REV0",
        label: "pass",
      })
    ).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
      error: expect.stringContaining("REV1"),
    });
    expect(
      await action({
        instanceId,
        exampleId: "EX1",
        expectedRevisionId: "REV1",
        label: "excellent",
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("pass, fail"),
    });
    expect(
      await action({
        instanceId,
        exampleId: "missing",
        expectedRevisionId: "REV1",
        label: "pass",
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(saveNow).not.toHaveBeenCalled();
  });

  it("requires an evaluator task", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const { action } = createAction(playgroundStore);

    expect(
      await action({
        exampleId: "EX1",
        expectedRevisionId: "REV1",
        label: "pass",
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("needs an explicit example and revision", () => {
    expect(
      setExpectedOutputInputSchema.safeParse({ exampleId: "EX1", label: null })
        .success
    ).toBe(false);
    expect(
      setExpectedOutputInputSchema.safeParse({
        exampleId: "EX1",
        expectedRevisionId: "REV1",
        label: null,
        score: 0.5,
      }).success
    ).toBe(true);
  });
});

describe("toEvaluatorTaskOutputConfigs", () => {
  it("treats a config without a kind as categorical and keeps the others", () => {
    expect(
      toEvaluatorTaskOutputConfigs([
        {
          name: "quality",
          optimizationDirection: "MAXIMIZE",
          values: [{ label: "pass", score: 1 }, { label: "fail" }],
        },
        {
          kind: "continuous",
          name: "score",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 1,
        },
      ])
    ).toEqual([
      {
        name: "quality",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "pass", score: 1 },
          { label: "fail", score: undefined },
        ],
      },
      {
        name: "score",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      },
    ]);
  });
});
