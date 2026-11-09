import { describe, expect, it } from "vitest";

import {
  createPlaygroundEvaluatorTask,
  DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG,
  getPlaygroundEvaluatorTask,
  getPlaygroundTaskType,
  getPlaygroundMode,
  isDecisionInstance,
  isPlaygroundModeLocked,
} from "../playgroundTask";
import type { PlaygroundTask } from "../types";

const promptTask: PlaygroundTask = { type: "prompt" };

const decisionTask: PlaygroundTask = { type: "decision" };

const evaluatorTask: PlaygroundTask = {
  type: "evaluator",
  evaluator: createPlaygroundEvaluatorTask({ kind: "CODE" }),
};

describe("getPlaygroundTaskType and isDecisionInstance", () => {
  it("reads the type off the task, the one place it is recorded", () => {
    expect(getPlaygroundTaskType({ task: promptTask })).toBe("prompt");
    expect(getPlaygroundTaskType({ task: decisionTask })).toBe("decision");
    expect(isDecisionInstance({ task: decisionTask })).toBe(true);
    expect(isDecisionInstance({ task: promptTask })).toBe(false);
    expect(isDecisionInstance(undefined)).toBe(false);
  });
});

describe("getPlaygroundMode", () => {
  it("is the mode of the first instance's task type", () => {
    expect(getPlaygroundMode([{ task: promptTask }])).toBe("task");
    expect(getPlaygroundMode([{ task: decisionTask }])).toBe("task");
    expect(
      getPlaygroundMode([{ task: evaluatorTask }, { task: evaluatorTask }])
    ).toBe("evaluator");
  });

  it("treats a page of prompts and decisions as one task page", () => {
    expect(
      getPlaygroundMode([{ task: decisionTask }, { task: promptTask }])
    ).toBe("task");
  });

  it("treats an empty page as a task page", () => {
    expect(getPlaygroundMode([])).toBe("task");
  });
});

describe("isPlaygroundModeLocked", () => {
  it("locks the mode once there is more than one instance", () => {
    expect(isPlaygroundModeLocked([])).toBe(false);
    expect(isPlaygroundModeLocked([{ task: promptTask }])).toBe(false);
    expect(
      isPlaygroundModeLocked([{ task: promptTask }, { task: decisionTask }])
    ).toBe(true);
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
      source: {
        evaluatorId: null,
        datasetEvaluatorId: null,
        projectEvaluatorId: null,
      },
      savedContentKey: null,
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
      source: {
        evaluatorId: "E1",
        datasetEvaluatorId: null,
        projectEvaluatorId: null,
      },
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
