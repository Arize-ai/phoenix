import { describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { evaluatorSlotEditSchema } from "@phoenix/agent/uiOperations/operations/evaluatorPlayground";
import { createEvaluatorStore } from "@phoenix/store/evaluatorStore";
import { createPlaygroundStore } from "@phoenix/store/playground";

import { createEvaluatorAgentSlot } from "../evaluatorAgentSlot";

installTestStorage();

function createSlot(
  sourceKey = "new-code",
  slotId: "A" | "B" = "A",
  kind: "LLM" | "CODE" = "CODE"
) {
  const store = createEvaluatorStore({
    evaluator: {
      kind,
      globalName: "quality",
      name: "quality",
      description: "",
      inputMapping: { pathMapping: {}, literalMapping: {} },
      isBuiltin: false,
      includeExplanation: true,
    },
    outputConfigs: [
      {
        name: "quality",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "pass", score: 1 },
          { label: "fail", score: 0 },
        ],
      },
    ],
  });
  let local = {
    language: "PYTHON" as "PYTHON" | "TYPESCRIPT",
    sourceCode: 'def evaluate(output): return "pass"',
    sandboxConfigId: "python" as string | null,
    selectedOutput: "",
  };
  const save = vi.fn(async () => ({
    ok: true as const,
    output: { datasetEvaluatorId: "saved" },
  }));
  const playgroundStore =
    kind === "LLM"
      ? createPlaygroundStore({ datasetId: null, modelConfigByProvider: {} })
      : null;
  const host = createEvaluatorAgentSlot({
    slotId,
    kind,
    sourceKey,
    store,
    playgroundStore,
    getLocal: () => local,
    setLocal: (next) => {
      local = next;
    },
    getPreferences: () => ({}),
    modelCatalog: {
      installedBuiltInProviders: new Set(["OPENAI"]),
      customProviders: [],
    },
    sandboxConfigs: [
      { id: "python", name: "Python", language: "PYTHON" },
      { id: "typescript", name: "TypeScript", language: "TYPESCRIPT" },
    ],
    save,
  });
  return { host, store, save, playgroundStore };
}
describe("evaluator playground slot adapter", () => {
  it("edits an isolated LLM prompt, model and rubric without affecting the other slot", async () => {
    const first = createSlot("new-llm", "A", "LLM");
    const second = createSlot("new-llm", "B", "LLM");
    const before = first.host.read();
    expect(
      await second.host.edit({
        slot: "B",
        expectedRevision: second.host.read().revision,
        messages: [
          { role: "system", content: "Judge accuracy." },
          { role: "user", content: "{{output}}" },
        ],
        model: {
          provider: "OPENAI",
          name: "gpt-4o",
          invocationParameters: { temperature: 0 },
        },
        templateFormat: "MUSTACHE",
        includeExplanation: false,
      })
    ).toMatchObject({ ok: true });
    expect(first.host.read()).toEqual(before);
    expect(second.host.read()).toMatchObject({
      includeExplanation: false,
      prompt: { modelName: "gpt-4o" },
    });
    expect(
      Object.values(second.playgroundStore!.getState().allInstanceMessages).map(
        ({ content }) => content
      )
    ).toEqual(["Judge accuracy.", "{{output}}"]);
    const edited = second.host.read();
    expect(
      await second.host.edit({
        slot: "B",
        expectedRevision: edited.revision,
        sourceCode: "invalid",
      })
    ).toMatchObject({ ok: false });
    expect(second.host.read()).toEqual(edited);
    expect(second.save).not.toHaveBeenCalled();
  });
  it("edits one of two same-kind slots without altering the other or saving", async () => {
    const first = createSlot();
    const second = createSlot("new-code", "B");
    const before = first.host.read();
    const result = await second.host.edit({
      slot: "B",
      expectedRevision: second.host.read().revision,
      name: "candidate",
      sourceCode: 'def evaluate(output): return "fail"',
      inputMapping: {
        pathMapping: { output: "output.answer" },
        literalMapping: { reference: "expected" },
      },
    });
    expect(result.ok).toBe(true);
    expect(first.host.read()).toEqual(before);
    expect(second.host.read()).toMatchObject({
      name: "candidate",
      sourceCode: 'def evaluate(output): return "fail"',
    });
    expect(second.save).not.toHaveBeenCalled();
  });
  it("rejects stale revisions for edits and saves, including a replaced source", async () => {
    const { host, store, save } = createSlot();
    const revision = host.read().revision;
    store.getState().setEvaluatorGlobalName("user edit");
    expect(
      await host.edit({
        slot: "A",
        expectedRevision: revision,
        name: "overwrite",
      })
    ).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(await host.save(revision)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(await createSlot("saved-source").host.save(revision)).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
    });
    expect(save).not.toHaveBeenCalled();
  });
  it("validates the entire patch before applying name or code changes", async () => {
    const { host } = createSlot();
    const before = host.read();
    const result = await host.edit({
      slot: "A",
      expectedRevision: before.revision,
      name: "must not change",
      language: "TYPESCRIPT",
    });
    expect(result.ok).toBe(false);
    expect(host.read()).toEqual(before);
    expect(
      (
        await host.edit({
          slot: "A",
          expectedRevision: before.revision,
          messages: [{ role: "user", content: "wrong kind" }],
        })
      ).ok
    ).toBe(false);
    expect(host.read()).toEqual(before);
  });
  it("changes code language and compatible sandbox together and saves explicitly", async () => {
    const { host, save } = createSlot();
    expect(
      (
        await host.edit({
          slot: "A",
          expectedRevision: host.read().revision,
          language: "TYPESCRIPT",
          sandboxConfigId: "typescript",
          sourceCode: 'function evaluate() { return "pass"; }',
        })
      ).ok
    ).toBe(true);
    expect(host.read()).toMatchObject({
      language: "TYPESCRIPT",
      sandboxConfigId: "typescript",
    });
    expect(await host.save(host.read().revision)).toMatchObject({
      ok: true,
      output: { datasetEvaluatorId: "saved" },
    });
    expect(save).toHaveBeenCalledOnce();
  });
  it("rejects numeric prompt targets, missing revisions, and arbitrary patch fields", () => {
    expect(
      evaluatorSlotEditSchema.safeParse({ slot: 0, expectedRevision: "r" })
        .success
    ).toBe(false);
    expect(
      evaluatorSlotEditSchema.safeParse({ slot: "A", name: "x" }).success
    ).toBe(false);
    expect(
      evaluatorSlotEditSchema.safeParse({
        slot: "A",
        expectedRevision: "r",
        testPayload: {},
      }).success
    ).toBe(false);
  });
});
