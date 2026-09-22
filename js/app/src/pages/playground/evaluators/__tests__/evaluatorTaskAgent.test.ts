import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { editEvaluatorTaskInputSchema } from "@phoenix/agent/tools/playgroundEvaluator/schemas";
import { createEvaluatorStore } from "@phoenix/store/evaluatorStore";
import type {
  PlaygroundEvaluatorTaskCode,
  PlaygroundEvaluatorTaskKind,
} from "@phoenix/store/playground";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

import type { EvaluatorSaveTarget } from "../evaluatorSaveTarget";
import { createEvaluatorTaskAgentHost } from "../evaluatorTaskAgent";
import { createEvaluatorTaskStoreState } from "../evaluatorTaskSnapshot";

installTestStorage();

const SANDBOX_CONFIGS = [
  { id: "python", name: "Python", language: "PYTHON" as const },
  { id: "typescript", name: "TypeScript", language: "TYPESCRIPT" as const },
];

/**
 * A page of evaluator tasks, each with its own evaluator store and adapter,
 * the way the editors mount them.
 */
function createPage(kinds: PlaygroundEvaluatorTaskKind[]) {
  const playgroundStore = createPlaygroundStore({
    datasetId: null,
    modelConfigByProvider: {},
  });

  const [first] = playgroundStore.getState().instances;

  const instanceIds = kinds.map((kind, index) =>
    index === 0
      ? playgroundStore.getState().replaceInstance({
          instanceId: first.id,
          source: { type: "new", kind },
        })!
      : playgroundStore.getState().addInstance({ type: "new", kind })!
  );

  return { playgroundStore, instanceIds };
}

function createHost({
  playgroundStore,
  instanceId,
  saveTarget = { action: "create" },
  sandboxConfigs = SANDBOX_CONFIGS,
}: {
  playgroundStore: ReturnType<typeof createPage>["playgroundStore"];
  instanceId: number;
  saveTarget?: EvaluatorSaveTarget;
  sandboxConfigs?: typeof SANDBOX_CONFIGS;
}) {
  const instance = playgroundStore
    .getState()
    .instances.find((candidate) => candidate.id === instanceId)!;

  if (instance.task.kind !== "evaluator") throw new Error("not an evaluator");
  const evaluator = instance.task.evaluator;
  const store = createEvaluatorStore(createEvaluatorTaskStoreState(evaluator));

  let code: PlaygroundEvaluatorTaskCode | null =
    evaluator.kind === "CODE"
      ? {
          language: "PYTHON",
          sourceCode: 'def evaluate(output): return "pass"',
          sandboxConfigId: "python",
        }
      : null;

  const save = vi.fn(async () => ({
    ok: true as const,
    output: { datasetEvaluatorId: "saved" },
  }));

  const validationError = vi.fn((): string | null => null);

  const host = createEvaluatorTaskAgentHost({
    instanceId,
    store,
    playgroundStore,
    getCode: () => code,
    setCode: (next) => {
      code = next;
    },
    getSandboxConfigs: () => sandboxConfigs,
    getSaveTarget: () => saveTarget,
    getValidationError: validationError,
    getDatasetId: () => "dataset-1",
    save,
  });

  return { host, store, save, validationError, getCode: () => code };
}

describe("evaluator task adapter", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("reads the task in the operation's shape", () => {
    const { playgroundStore, instanceIds } = createPage(["CODE"]);

    const { host } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
    });

    const read = host.read();
    expect(read).toMatchObject({
      instanceId: instanceIds[0],
      index: 0,
      label: "A",
      dirty: false,
      kind: "CODE",
      name: "",
      annotationName: "evaluator_1",
      code: { language: "PYTHON", sandboxConfigId: "python" },
      source: { evaluatorId: null, datasetEvaluatorId: null },
      datasetId: "dataset-1",
      saveTarget: { action: "create" },
      validationError: null,
      availableSandboxConfigs: SANDBOX_CONFIGS,
    });
    expect(read.outputConfigs).toEqual([
      {
        kind: "classification",
        name: "result",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "pass", score: 1 },
          { label: "fail", score: 0 },
        ],
      },
    ]);
    expect(read).not.toHaveProperty("includeExplanation");
    expect(read.revision).toMatch(/^evaluator-/);
  });

  it("edits one of two tasks without touching the other or saving", () => {
    const { playgroundStore, instanceIds } = createPage(["CODE", "CODE"]);
    const first = createHost({ playgroundStore, instanceId: instanceIds[0] });
    const second = createHost({ playgroundStore, instanceId: instanceIds[1] });
    const before = first.host.read();

    const result = second.host.edit({
      expectedRevision: second.host.read().revision,
      name: "candidate",
      sourceCode: 'def evaluate(output): return "fail"',
      inputMapping: {
        pathMapping: { output: "output.answer" },
        literalMapping: { reference: "expected" },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      output: {
        label: "B",
        name: "candidate",
        annotationName: "candidate",
        code: { sourceCode: 'def evaluate(output): return "fail"' },
        inputMapping: {
          pathMapping: { output: "output.answer" },
          literalMapping: { reference: "expected" },
        },
      },
    });
    expect(first.host.read()).toEqual(before);
    expect(second.store.getState().evaluator.globalName).toBe("candidate");
    expect(second.getCode()?.sourceCode).toBe(
      'def evaluate(output): return "fail"'
    );
    expect(second.save).not.toHaveBeenCalled();
  });

  it("edits an LLM task's explanation flag and rejects code fields on it", () => {
    const { playgroundStore, instanceIds } = createPage(["LLM"]);

    const { host, store } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
    });

    expect(host.read()).toMatchObject({
      kind: "LLM",
      includeExplanation: true,
      code: null,
    });
    expect(host.read()).not.toHaveProperty("availableSandboxConfigs");

    expect(
      host.edit({
        expectedRevision: host.read().revision,
        includeExplanation: false,
      })
    ).toMatchObject({ ok: true, output: { includeExplanation: false } });
    expect(store.getState().evaluator.includeExplanation).toBe(false);

    expect(
      host.edit({
        expectedRevision: host.read().revision,
        sourceCode: "print()",
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("CODE evaluator tasks only"),
    });
  });

  it("rejects stale revisions for edits and saves", async () => {
    const { playgroundStore, instanceIds } = createPage(["CODE"]);

    const { host, store, save } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
    });

    const revision = host.read().revision;
    store.getState().setEvaluatorGlobalName("user edit");

    expect(
      host.edit({ expectedRevision: revision, name: "overwrite" })
    ).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
      error: expect.stringContaining(host.read().revision),
    });
    expect(await host.save(revision, { asNew: false })).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(store.getState().evaluator.globalName).toBe("user edit");
    expect(save).not.toHaveBeenCalled();
  });

  it("validates the whole patch before applying any of it", () => {
    const { playgroundStore, instanceIds } = createPage(["CODE"]);

    const { host, store } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
      // No TypeScript sandbox, so a language switch cannot pick one.
      sandboxConfigs: [SANDBOX_CONFIGS[0]],
    });

    const before = host.read();

    expect(
      host.edit({
        expectedRevision: before.revision,
        name: "must not change",
        language: "TYPESCRIPT",
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining("sandbox") });
    expect(host.read()).toEqual(before);
    expect(store.getState().evaluator.globalName).toBe("");

    expect(
      host.edit({
        expectedRevision: before.revision,
        name: "must not change",
        includeExplanation: false,
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("LLM evaluator tasks only"),
    });
    expect(host.read()).toEqual(before);
  });

  it("rejects an LLM task's non-categorical outputs and duplicate names", () => {
    const { playgroundStore, instanceIds } = createPage(["LLM"]);

    const { host } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
    });

    expect(
      host.edit({
        expectedRevision: host.read().revision,
        outputConfigs: [
          {
            kind: "continuous",
            name: "score",
            optimizationDirection: "MAXIMIZE",
            lowerBound: 0,
            upperBound: 1,
          },
        ],
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining("score") });
    expect(host.read().outputConfigs).toHaveLength(1);
  });

  it("changes language and sandbox together, or picks a compatible sandbox", () => {
    const { playgroundStore, instanceIds } = createPage(["CODE"]);

    const { host } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
    });

    expect(
      host.edit({
        expectedRevision: host.read().revision,
        language: "TYPESCRIPT",
        sandboxConfigId: "typescript",
        sourceCode: 'function evaluate() { return "pass"; }',
      })
    ).toMatchObject({
      ok: true,
      output: {
        code: { language: "TYPESCRIPT", sandboxConfigId: "typescript" },
      },
    });
    expect(
      host.edit({ expectedRevision: host.read().revision, language: "PYTHON" })
    ).toMatchObject({
      ok: true,
      output: { code: { language: "PYTHON", sandboxConfigId: "python" } },
    });
    expect(
      host.edit({
        expectedRevision: host.read().revision,
        sandboxConfigId: "typescript",
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining("sandbox") });
  });

  it("saves through the Save button's write once the revision matches", async () => {
    const { playgroundStore, instanceIds } = createPage(["CODE"]);

    const { host, save, validationError } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
    });

    validationError.mockReturnValue("Enter evaluator code before running.");
    expect(
      await host.save(host.read().revision, { asNew: false })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Enter evaluator code"),
    });
    expect(save).not.toHaveBeenCalled();

    validationError.mockReturnValue(null);
    expect(
      await host.save(host.read().revision, { asNew: false })
    ).toMatchObject({
      ok: true,
      output: { datasetEvaluatorId: "saved" },
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it("reports the save target and keeps a saved code evaluator's language", () => {
    const { playgroundStore, instanceIds } = createPage(["CODE"]);

    const saveTarget: EvaluatorSaveTarget = {
      action: "update",
      evaluatorId: "code-1",
      datasetEvaluatorId: "binding-1",
    };

    const { host } = createHost({
      playgroundStore,
      instanceId: instanceIds[0],
      saveTarget,
    });

    expect(host.read().saveTarget).toEqual(saveTarget);
    expect(
      host.edit({
        expectedRevision: host.read().revision,
        language: "TYPESCRIPT",
        sandboxConfigId: "typescript",
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining("language") });
    expect(host.read().code).toMatchObject({ language: "PYTHON" });
  });

  it("rejects slot ids, missing revisions and arbitrary patch fields", () => {
    expect(
      editEvaluatorTaskInputSchema.safeParse({
        slot: "A",
        expectedRevision: "r",
      }).success
    ).toBe(false);
    expect(
      editEvaluatorTaskInputSchema.safeParse({ instanceId: 1, name: "x" })
        .success
    ).toBe(false);
    expect(
      editEvaluatorTaskInputSchema.safeParse({
        instanceId: 1,
        expectedRevision: "r",
        testPayload: {},
      }).success
    ).toBe(false);
    expect(
      editEvaluatorTaskInputSchema.safeParse({
        expectedRevision: "r",
        outputConfigs: [
          {
            name: "quality",
            optimizationDirection: "MAXIMIZE",
            values: [{ label: "good", score: 1 }, { label: "bad" }],
          },
        ],
      }).success
    ).toBe(true);
  });
});
