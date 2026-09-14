import { describe, expect, it } from "vitest";

import {
  createPlaygroundEvaluatorTask,
  DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG,
  getPlaygroundEvaluatorTask,
  getPlaygroundTaskKind,
  getTaskKindForNewSource,
  isTaskKindLocked,
} from "../playgroundTask";
import type { PlaygroundTask } from "../types";

const promptTask: PlaygroundTask = { kind: "prompt" };
const evaluatorTask: PlaygroundTask = {
  kind: "evaluator",
  evaluator: createPlaygroundEvaluatorTask({ kind: "CODE" }),
};

describe("getPlaygroundTaskKind", () => {
  it("is the first instance's kind", () => {
    expect(getPlaygroundTaskKind([{ task: promptTask }])).toBe("prompt");
    expect(
      getPlaygroundTaskKind([{ task: evaluatorTask }, { task: evaluatorTask }])
    ).toBe("evaluator");
  });

  it("treats an empty page as a prompt page", () => {
    expect(getPlaygroundTaskKind([])).toBe("prompt");
  });
});

describe("isTaskKindLocked", () => {
  it("locks the kind once there is more than one instance", () => {
    expect(isTaskKindLocked([])).toBe(false);
    expect(isTaskKindLocked([{ task: promptTask }])).toBe(false);
    expect(isTaskKindLocked([{ task: promptTask }, { task: promptTask }])).toBe(
      true
    );
  });
});

describe("createPlaygroundEvaluatorTask", () => {
  it("starts an LLM draft with a pass/fail output and no code", () => {
    const task = createPlaygroundEvaluatorTask({ kind: "LLM" });
    expect(task).toMatchObject({
      kind: "LLM",
      name: "",
      includeExplanation: true,
      code: null,
      source: { evaluatorId: null, datasetEvaluatorId: null },
      savedRevision: null,
    });
    expect(task.outputConfigs).toEqual([DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG]);
  });

  it("starts a code draft on the dataset placeholder source with no sandbox", () => {
    const task = createPlaygroundEvaluatorTask({ kind: "CODE" });
    expect(task.code).toMatchObject({
      language: "PYTHON",
      sandboxConfigId: null,
    });
    expect(task.code?.sourceCode).toContain("def evaluate(output, reference");
  });

  it("lets a fetched evaluator override the defaults", () => {
    const task = createPlaygroundEvaluatorTask({
      kind: "LLM",
      name: "correctness",
      source: { evaluatorId: "E1", datasetEvaluatorId: null },
    });
    expect(task.name).toBe("correctness");
    expect(task.source.evaluatorId).toBe("E1");
    expect(task.outputConfigs).toEqual([DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG]);
  });
});

describe("getPlaygroundEvaluatorTask", () => {
  it("returns the evaluator draft only for evaluator instances", () => {
    expect(getPlaygroundEvaluatorTask({ task: evaluatorTask })?.kind).toBe(
      "CODE"
    );
    expect(getPlaygroundEvaluatorTask({ task: promptTask })).toBeNull();
    expect(getPlaygroundEvaluatorTask(undefined)).toBeNull();
  });
});

describe("getTaskKindForNewSource", () => {
  it("maps evaluator kinds to the evaluator task kind", () => {
    expect(getTaskKindForNewSource("prompt")).toBe("prompt");
    expect(getTaskKindForNewSource("LLM")).toBe("evaluator");
    expect(getTaskKindForNewSource("CODE")).toBe("evaluator");
  });
});
