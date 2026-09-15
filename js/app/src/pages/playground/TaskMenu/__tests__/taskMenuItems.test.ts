import { describe, expect, it } from "vitest";

import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import {
  getTaskMenuLabel,
  getTaskMenuSections,
  getTaskMenuSelectedKey,
  parseTaskMenuKey,
} from "../taskMenuItems";

const prompts = [
  { id: "P1", name: "Summarize", latestVersionId: "V1" },
  { id: "P2", name: "Classify", latestVersionId: null },
];
const evaluators = [{ id: "E1", name: "correctness", kind: "CODE" as const }];
const matches = (text: string, search: string) =>
  text.toLowerCase().includes(search.toLowerCase());

describe("getTaskMenuSections", () => {
  it("offers both kinds and every New action while the kind is unlocked", () => {
    const sections = getTaskMenuSections({
      kind: "prompt",
      isLocked: false,
      prompts,
      evaluators,
      search: "",
      matches,
    });
    expect(sections.map((section) => section.id)).toEqual([
      "prompts",
      "evaluators",
      "new",
    ]);
    expect(sections[2].items.map((item) => item.key)).toEqual([
      "new:prompt",
      "new:LLM",
      "new:CODE",
    ]);
  });

  it("keeps only the locked kind's section and New actions", () => {
    const sections = getTaskMenuSections({
      kind: "evaluator",
      isLocked: true,
      prompts,
      evaluators,
      search: "",
      matches,
    });
    expect(sections.map((section) => section.id)).toEqual([
      "evaluators",
      "new",
    ]);
    expect(sections[1].items.map((item) => item.key)).toEqual([
      "new:LLM",
      "new:CODE",
    ]);
  });

  it("filters prompts by the search and drops an emptied section", () => {
    const sections = getTaskMenuSections({
      kind: "prompt",
      isLocked: true,
      prompts,
      evaluators: [],
      search: "class",
      matches,
    });
    expect(sections[0].items).toEqual([
      { key: "prompt:P2", label: "Classify" },
    ]);
    expect(
      getTaskMenuSections({
        kind: "prompt",
        isLocked: true,
        prompts,
        evaluators: [],
        search: "nothing",
        matches,
      }).map((section) => section.id)
    ).toEqual(["new"]);
  });
});

describe("parseTaskMenuKey", () => {
  it("maps keys to instance sources, loading a prompt's latest version", () => {
    expect(parseTaskMenuKey("duplicate", prompts)).toEqual({
      type: "duplicate",
    });
    expect(parseTaskMenuKey("new:CODE", prompts)).toEqual({
      type: "new",
      kind: "CODE",
    });
    expect(parseTaskMenuKey("prompt:P1", prompts)).toEqual({
      type: "prompt",
      promptId: "P1",
      promptVersionId: "V1",
      tagName: null,
    });
    expect(parseTaskMenuKey("prompt:P2", prompts)).toMatchObject({
      promptVersionId: null,
    });
    expect(parseTaskMenuKey("evaluator:E1", prompts)).toEqual({
      type: "evaluator",
      evaluatorId: "E1",
    });
  });

  it("rejects unknown keys", () => {
    expect(parseTaskMenuKey("new:BUILTIN", prompts)).toBeNull();
    expect(parseTaskMenuKey("garbage", prompts)).toBeNull();
    expect(parseTaskMenuKey("dataset:D1", prompts)).toBeNull();
  });
});

describe("getTaskMenuSelectedKey and getTaskMenuLabel", () => {
  const evaluatorInstance = (
    overrides: Partial<ReturnType<typeof createPlaygroundEvaluatorTask>>
  ) => ({
    task: {
      kind: "evaluator" as const,
      evaluator: createPlaygroundEvaluatorTask({ kind: "LLM", ...overrides }),
    },
    prompt: null,
    loadingSource: null,
  });

  it("selects the loaded prompt and reads its name", () => {
    const instance = {
      task: { kind: "prompt" as const },
      prompt: { id: "P1", name: "Summarize", version: "V1", tag: null },
      loadingSource: null,
    };
    expect(getTaskMenuSelectedKey(instance)).toBe("prompt:P1");
    expect(getTaskMenuLabel(instance)).toBe("Summarize");
  });

  it("has no selection and no label for a fresh prompt task", () => {
    const instance = {
      task: { kind: "prompt" as const },
      prompt: null,
      loadingSource: null,
    };
    expect(getTaskMenuSelectedKey(instance)).toBeNull();
    expect(getTaskMenuLabel(instance)).toBeNull();
  });

  it("selects a loaded evaluator by its id and names the draft", () => {
    const loaded = evaluatorInstance({
      name: "tone",
      source: { evaluatorId: "E1", datasetEvaluatorId: "DE1" },
    });
    expect(getTaskMenuSelectedKey(loaded)).toBe("evaluator:E1");
    expect(getTaskMenuLabel(loaded)).toBe("tone");
  });

  it("selects the New action for a nameless draft and says what it is", () => {
    const draft = evaluatorInstance({ kind: "CODE" });
    expect(getTaskMenuSelectedKey(draft)).toBe("new:CODE");
    expect(getTaskMenuLabel(draft)).toBe("New code evaluator");
  });

  it("says Loading while a saved source is being fetched", () => {
    expect(
      getTaskMenuLabel({
        task: { kind: "prompt" },
        prompt: null,
        loadingSource: { type: "prompt", promptId: "P1" },
      })
    ).toBe("Loading…");
  });
});
