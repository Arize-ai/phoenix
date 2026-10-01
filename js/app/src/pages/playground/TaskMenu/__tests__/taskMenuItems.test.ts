import { describe, expect, it } from "vitest";

import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import {
  getTaskMenuLabel,
  getTaskMenuSelectedKey,
  getTaskMenuTabs,
  parseTaskMenuKey,
} from "../taskMenuItems";

const prompts = [
  { id: "P1", name: "Summarize", latestVersionId: "V1" },
  { id: "P2", name: "Classify", latestVersionId: null },
];

const evaluators = [{ id: "E1", name: "correctness", kind: "CODE" as const }];

const matches = (text: string, search: string) =>
  text.toLowerCase().includes(search.toLowerCase());

describe("getTaskMenuTabs", () => {
  it("offers a tab per kind, each with its items and New actions, while the kind is unlocked", () => {
    const tabs = getTaskMenuTabs({
      kind: "prompt",
      isLocked: false,
      prompts,
      evaluators,
      search: "",
      matches,
    });

    expect(tabs.map((tab) => [tab.kind, tab.title])).toEqual([
      ["prompt", "Prompts"],
      ["evaluator", "Evaluators"],
    ]);
    expect(tabs[0].sections.map((section) => section.id)).toEqual([
      "prompts",
      "new",
    ]);
    expect(tabs[0].sections[1].items.map((item) => item.key)).toEqual([
      "new:prompt",
    ]);
    expect(tabs[1].sections.map((section) => section.id)).toEqual([
      "evaluators",
      "new",
    ]);
    expect(tabs[1].sections[1].items.map((item) => item.key)).toEqual([
      "new:LLM",
      "new:CODE",
    ]);
  });

  it("keeps only the locked kind's tab", () => {
    const tabs = getTaskMenuTabs({
      kind: "evaluator",
      isLocked: true,
      prompts,
      evaluators,
      search: "",
      matches,
    });

    expect(tabs.map((tab) => tab.kind)).toEqual(["evaluator"]);
    expect(tabs[0].sections.map((section) => section.id)).toEqual([
      "evaluators",
      "new",
    ]);
  });

  it("filters prompts by the search and drops an emptied section", () => {
    const [tab] = getTaskMenuTabs({
      kind: "prompt",
      isLocked: true,
      prompts,
      evaluators: [],
      search: "class",
      matches,
    });

    expect(tab.sections[0].items).toEqual([
      { key: "prompt:P2", label: "Classify" },
    ]);
    expect(
      getTaskMenuTabs({
        kind: "prompt",
        isLocked: true,
        prompts,
        evaluators: [],
        search: "nothing",
        matches,
      })[0].sections.map((section) => section.id)
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
      source: {
        evaluatorId: "E1",
        datasetEvaluatorId: "DE1",
        projectEvaluatorId: null,
      },
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
