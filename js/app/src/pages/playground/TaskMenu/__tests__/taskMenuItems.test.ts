import { describe, expect, it } from "vitest";

import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import {
  doesSourceLoadInPlace,
  getTaskMenuLabel,
  getTaskMenuSelectedKey,
  getTaskMenuTabs,
  parseTaskMenuKey,
} from "../taskMenuItems";

const prompts = [
  { id: "P1", name: "Summarize", latestVersionId: "V1" },
  { id: "P2", name: "Classify", latestVersionId: null },
];

const decisions = [
  { id: "D1", name: "triage" },
  { id: "D2", name: "routing" },
];

const evaluators = [{ id: "E1", name: "correctness", kind: "CODE" as const }];

const matches = (text: string, search: string) =>
  text.toLowerCase().includes(search.toLowerCase());

const options = { prompts, decisions, evaluators, search: "", matches };

describe("getTaskMenuTabs", () => {
  it("offers a tab per member, grouped by role, each with its items and New actions, while the role is unlocked", () => {
    const tabs = getTaskMenuTabs({
      role: "tested",
      isLocked: false,
      ...options,
    });

    expect(tabs.map((tab) => [tab.member, tab.title])).toEqual([
      ["prompt", "Prompts"],
      ["decision", "Decisions"],
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
      "decisions",
      "new",
    ]);
    expect(tabs[1].sections[0].items).toEqual([
      { key: "decision:D1", label: "triage" },
      { key: "decision:D2", label: "routing" },
    ]);
    expect(tabs[1].sections[1].items.map((item) => item.key)).toEqual([
      "new:decision",
    ]);
    expect(tabs[2].sections.map((section) => section.id)).toEqual([
      "evaluators",
      "new",
    ]);
    expect(tabs[2].sections[1].items.map((item) => item.key)).toEqual([
      "new:LLM",
      "new:CODE",
    ]);
  });

  it("keeps both members of the tested role when it is locked, and hides the judging role", () => {
    const tabs = getTaskMenuTabs({
      role: "tested",
      isLocked: true,
      ...options,
    });

    expect(tabs.map((tab) => tab.member)).toEqual(["prompt", "decision"]);
  });

  it("keeps only the evaluator tab when the judging role is locked", () => {
    const tabs = getTaskMenuTabs({
      role: "judging",
      isLocked: true,
      ...options,
    });

    expect(tabs.map((tab) => tab.member)).toEqual(["evaluator"]);
    expect(tabs[0].sections.map((section) => section.id)).toEqual([
      "evaluators",
      "new",
    ]);
  });

  it("filters prompts by the search and drops an emptied section", () => {
    const [tab] = getTaskMenuTabs({
      role: "tested",
      isLocked: true,
      ...options,
      evaluators: [],
      search: "class",
    });

    expect(tab.sections[0].items).toEqual([
      { key: "prompt:P2", label: "Classify" },
    ]);
    expect(
      getTaskMenuTabs({
        role: "tested",
        isLocked: true,
        ...options,
        evaluators: [],
        search: "nothing",
      })[0].sections.map((section) => section.id)
    ).toEqual(["new"]);
  });

  it("lists decisions as the server filtered them, and offers New when there are none", () => {
    const [, decisionTab] = getTaskMenuTabs({
      role: "tested",
      isLocked: true,
      ...options,
      decisions: [],
    });

    expect(decisionTab.sections.map((section) => section.id)).toEqual(["new"]);
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
    expect(parseTaskMenuKey("new:decision", prompts)).toEqual({
      type: "new",
      kind: "decision",
    });
    expect(parseTaskMenuKey("decision:D1", prompts)).toEqual({
      type: "decision",
      decisionId: "D1",
      decisionVersionId: null,
      tagName: null,
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

describe("doesSourceLoadInPlace", () => {
  const prompt = "prompt" as const;
  const decision = "decision" as const;
  const promptSource = { type: "prompt" as const, promptId: "P1" };
  const decisionSource = { type: "decision" as const, decisionId: "D1" };

  it("loads a prompt into a prompt task and a decision into a decision task", () => {
    expect(doesSourceLoadInPlace(prompt, promptSource)).toBe(true);
    expect(doesSourceLoadInPlace(decision, decisionSource)).toBe(true);
  });

  it("replaces the task when the member changes, or for a new draft", () => {
    expect(doesSourceLoadInPlace(prompt, decisionSource)).toBe(false);
    expect(doesSourceLoadInPlace(decision, promptSource)).toBe(false);
    expect(
      doesSourceLoadInPlace(decision, { type: "new", kind: "decision" })
    ).toBe(false);
  });
});

describe("getTaskMenuSelectedKey and getTaskMenuLabel", () => {
  const evaluatorInstance = (
    overrides: Partial<ReturnType<typeof createPlaygroundEvaluatorTask>>
  ) => ({
    task: {
      member: "evaluator" as const,
      evaluator: createPlaygroundEvaluatorTask({ kind: "LLM", ...overrides }),
    },
    prompt: null,
    decision: null,
    loadingSource: null,
  });

  it("selects the loaded prompt and reads its name", () => {
    const instance = {
      task: { member: "prompt" as const },
      prompt: { id: "P1", name: "Summarize", version: "V1", tag: null },
      decision: null,
      loadingSource: null,
    };

    expect(getTaskMenuSelectedKey(instance)).toBe("prompt:P1");
    expect(getTaskMenuLabel(instance)).toBe("Summarize");
  });

  it("has no selection and no label for a fresh prompt task", () => {
    const instance = {
      task: { member: "prompt" as const },
      prompt: null,
      decision: null,
      loadingSource: null,
    };

    expect(getTaskMenuSelectedKey(instance)).toBeNull();
    expect(getTaskMenuLabel(instance)).toBeNull();
  });

  it("selects the loaded decision and reads its name", () => {
    const instance = {
      task: { member: "decision" as const },
      prompt: null,
      decision: { id: "D1", name: "triage", versionId: "DV1", tag: "prod" },
      loadingSource: null,
    };

    expect(getTaskMenuSelectedKey(instance)).toBe("decision:D1");
    expect(getTaskMenuLabel(instance)).toBe("triage");
  });

  it("selects the New action for a decision that was never saved", () => {
    const draft = {
      task: { member: "decision" as const },
      prompt: null,
      decision: null,
      loadingSource: null,
    };

    expect(getTaskMenuSelectedKey(draft)).toBe("new:decision");
    expect(getTaskMenuLabel(draft)).toBe("New decision");
  });

  it("ignores a decision reference an instance kept after becoming a prompt", () => {
    const instance = {
      task: { member: "prompt" as const },
      prompt: null,
      decision: { id: "D1", name: "triage", versionId: "DV1", tag: null },
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
        task: { member: "prompt" },
        prompt: null,
        decision: null,
        loadingSource: { type: "prompt", promptId: "P1" },
      })
    ).toBe("Loading…");
  });
});
