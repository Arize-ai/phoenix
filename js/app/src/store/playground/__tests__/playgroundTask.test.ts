import { describe, expect, it } from "vitest";

import {
  createPlaygroundEvaluatorTask,
  DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG,
  getPlaygroundEvaluatorTask,
  getPlaygroundTaskMember,
  getPlaygroundTaskRole,
  getTaskMemberForNewSource,
  isDecisionInstance,
  isTaskRoleLocked,
  PLAYGROUND_TASK_ROLE_BY_MEMBER,
} from "../playgroundTask";
import type { PlaygroundTask } from "../types";

const promptTask: PlaygroundTask = { member: "prompt" };

const decisionTask: PlaygroundTask = { member: "decision" };

const evaluatorTask: PlaygroundTask = {
  member: "evaluator",
  evaluator: createPlaygroundEvaluatorTask({ kind: "CODE" }),
};

describe("PLAYGROUND_TASK_ROLE_BY_MEMBER", () => {
  it("puts prompts and decisions in the tested role and evaluators in the judging role", () => {
    expect(PLAYGROUND_TASK_ROLE_BY_MEMBER).toEqual({
      prompt: "tested",
      decision: "tested",
      evaluator: "judging",
    });
  });
});

describe("getPlaygroundTaskMember and isDecisionInstance", () => {
  it("reads the member off the task, the one place it is recorded", () => {
    expect(getPlaygroundTaskMember({ task: promptTask })).toBe("prompt");
    expect(getPlaygroundTaskMember({ task: decisionTask })).toBe("decision");
    expect(isDecisionInstance({ task: decisionTask })).toBe(true);
    expect(isDecisionInstance({ task: promptTask })).toBe(false);
    expect(isDecisionInstance(undefined)).toBe(false);
  });
});

describe("getPlaygroundTaskRole", () => {
  it("is the role of the first instance's member", () => {
    expect(getPlaygroundTaskRole([{ task: promptTask }])).toBe("tested");
    expect(getPlaygroundTaskRole([{ task: decisionTask }])).toBe("tested");
    expect(
      getPlaygroundTaskRole([{ task: evaluatorTask }, { task: evaluatorTask }])
    ).toBe("judging");
  });

  it("treats a page of prompts and decisions as one tested page", () => {
    expect(
      getPlaygroundTaskRole([{ task: decisionTask }, { task: promptTask }])
    ).toBe("tested");
  });

  it("treats an empty page as a tested page", () => {
    expect(getPlaygroundTaskRole([])).toBe("tested");
  });
});

describe("isTaskRoleLocked", () => {
  it("locks the role once there is more than one instance", () => {
    expect(isTaskRoleLocked([])).toBe(false);
    expect(isTaskRoleLocked([{ task: promptTask }])).toBe(false);
    expect(
      isTaskRoleLocked([{ task: promptTask }, { task: decisionTask }])
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

describe("getTaskMemberForNewSource", () => {
  it("maps evaluator kinds to the evaluator task kind", () => {
    expect(getTaskMemberForNewSource("prompt")).toBe("prompt");
    expect(getTaskMemberForNewSource("decision")).toBe("decision");
    expect(getTaskMemberForNewSource("LLM")).toBe("evaluator");
    expect(getTaskMemberForNewSource("CODE")).toBe("evaluator");
  });
});
