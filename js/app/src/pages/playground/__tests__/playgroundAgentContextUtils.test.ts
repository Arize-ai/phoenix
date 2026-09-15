import { describe, expect, it } from "vitest";

import type { PlaygroundInstance } from "@phoenix/store/playground";
import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import {
  areExperimentScaffoldsForAgentEqual,
  arePlaygroundInstancesForAgentEqual,
  buildPlaygroundAgentContext,
  getExperimentScaffoldForAgent,
  getPlaygroundInstanceForAgent,
} from "../playgroundAgentContextUtils";

type AgentInstanceInput = Pick<
  PlaygroundInstance,
  "id" | "model" | "experiment" | "task"
>;

function makeInstance(
  overrides: Partial<AgentInstanceInput> = {}
): AgentInstanceInput {
  return {
    id: 0,
    model: {
      provider: "OPENAI",
      modelName: "gpt-4o",
    } as PlaygroundInstance["model"],
    experiment: null,
    task: { kind: "prompt" },
    ...overrides,
  };
}

const position = { index: 0, isDirty: false };

function evaluatorTask(name: string): PlaygroundInstance["task"] {
  return {
    kind: "evaluator",
    evaluator: createPlaygroundEvaluatorTask({ kind: "CODE", name }),
  };
}

describe("getPlaygroundInstanceForAgent", () => {
  it("includes a non-ephemeral experiment id", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({
        experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
      }),
      position
    );
    expect(result.experimentId).toBe("RXhwZXJpbWVudDox");
  });

  it("includes an ephemeral experiment id", () => {
    // Ephemeral experiments persist in the DB for ~24h, so they stay queryable
    // and should be surfaced to the agent like any other run.
    const result = getPlaygroundInstanceForAgent(
      makeInstance({
        experiment: { id: "RXhwZXJpbWVudDoy", isEphemeral: true },
      }),
      position
    );
    expect(result.experimentId).toBe("RXhwZXJpbWVudDoy");
  });

  it("omits the experiment id when no experiment is present", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({ experiment: null }),
      position
    );
    expect(result.experimentId).toBeUndefined();
  });

  it("includes the experiment id when the instance has no model selection", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({
        model: {
          provider: "OPENAI",
          modelName: null,
        } as PlaygroundInstance["model"],
        experiment: { id: "RXhwZXJpbWVudDoz", isEphemeral: false },
      }),
      position
    );
    expect(result.model).toBeUndefined();
    expect(result.experimentId).toBe("RXhwZXJpbWVudDoz");
  });

  it("advertises a prompt task", () => {
    expect(
      getPlaygroundInstanceForAgent(makeInstance(), position).task
    ).toEqual({ kind: "prompt" });
  });

  it("advertises an evaluator task under the name its runs use", () => {
    expect(
      getPlaygroundInstanceForAgent(
        makeInstance({ task: evaluatorTask("tone") }),
        { index: 1, isDirty: true }
      ).task
    ).toEqual({
      kind: "evaluator",
      evaluatorKind: "CODE",
      name: "tone",
      isDirty: true,
    });
    // A nameless draft in position B runs as evaluator_2.
    expect(
      getPlaygroundInstanceForAgent(makeInstance({ task: evaluatorTask("") }), {
        index: 1,
        isDirty: false,
      }).task
    ).toMatchObject({ name: "evaluator_2", isDirty: false });
  });
});

describe("arePlaygroundInstancesForAgentEqual", () => {
  it("returns false when only the experiment id changes", () => {
    const before = [
      getPlaygroundInstanceForAgent(
        makeInstance({ experiment: null }),
        position
      ),
    ];
    const after = [
      getPlaygroundInstanceForAgent(
        makeInstance({
          experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
        }),
        position
      ),
    ];
    expect(arePlaygroundInstancesForAgentEqual(before, after)).toBe(false);
  });

  it("returns true when the experiment id, model and task are unchanged", () => {
    const left = [
      getPlaygroundInstanceForAgent(
        makeInstance({
          experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
        }),
        position
      ),
    ];
    const right = [
      getPlaygroundInstanceForAgent(
        makeInstance({
          experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
        }),
        position
      ),
    ];
    expect(arePlaygroundInstancesForAgentEqual(left, right)).toBe(true);
  });

  it("returns false when a task is renamed, changes kind or flips dirty", () => {
    const named = [
      getPlaygroundInstanceForAgent(
        makeInstance({ task: evaluatorTask("tone") }),
        position
      ),
    ];

    const renamed = [
      getPlaygroundInstanceForAgent(
        makeInstance({ task: evaluatorTask("style") }),
        position
      ),
    ];

    const dirty = [
      getPlaygroundInstanceForAgent(
        makeInstance({ task: evaluatorTask("tone") }),
        { index: 0, isDirty: true }
      ),
    ];

    const prompt = [getPlaygroundInstanceForAgent(makeInstance(), position)];
    expect(arePlaygroundInstancesForAgentEqual(named, renamed)).toBe(false);
    expect(arePlaygroundInstancesForAgentEqual(named, dirty)).toBe(false);
    expect(arePlaygroundInstancesForAgentEqual(named, prompt)).toBe(false);
  });
});

describe("getExperimentScaffoldForAgent", () => {
  it("returns null when no scaffold is staged", () => {
    expect(getExperimentScaffoldForAgent(null)).toBeNull();
  });

  it("advertises staged name/description and metadata presence, not the metadata itself", () => {
    expect(
      getExperimentScaffoldForAgent({
        name: "Shorter prompt",
        description: "Trimmed by half",
        metadata: { hypothesis: "fewer tokens" },
      })
    ).toEqual({
      name: "Shorter prompt",
      description: "Trimmed by half",
      hasMetadata: true,
    });
  });

  it("reports hasMetadata false for an absent or empty metadata object", () => {
    expect(getExperimentScaffoldForAgent({ name: "X" })).toEqual({
      name: "X",
      description: null,
      hasMetadata: false,
    });
    expect(getExperimentScaffoldForAgent({ metadata: {} })).toEqual({
      name: null,
      description: null,
      hasMetadata: false,
    });
  });
});

describe("areExperimentScaffoldsForAgentEqual", () => {
  it("returns false when the staged name changes", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        getExperimentScaffoldForAgent({ name: "A" }),
        getExperimentScaffoldForAgent({ name: "B" })
      )
    ).toBe(false);
  });

  it("returns false when metadata presence first appears", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        getExperimentScaffoldForAgent({ name: "A" }),
        getExperimentScaffoldForAgent({ name: "A", metadata: { k: "v" } })
      )
    ).toBe(false);
  });

  it("returns false when a scaffold is staged or cleared", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        null,
        getExperimentScaffoldForAgent({ name: "A" })
      )
    ).toBe(false);
  });

  it("returns true for equivalent advertised scaffolds", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        getExperimentScaffoldForAgent({ name: "A", metadata: { k: "v" } }),
        getExperimentScaffoldForAgent({ name: "A", metadata: { k: "other" } })
      )
    ).toBe(true);
    expect(areExperimentScaffoldsForAgentEqual(null, null)).toBe(true);
  });
});

describe("buildPlaygroundAgentContext", () => {
  it("includes the task kind, the experiment recording mode and playground repetitions", () => {
    const instance = getPlaygroundInstanceForAgent(makeInstance(), position);

    expect(
      buildPlaygroundAgentContext({
        taskKind: "prompt",
        recordExperiments: false,
        repetitions: 4,
        nextExperimentScaffold: null,
        instances: [instance],
      })
    ).toEqual({
      type: "playground",
      taskKind: "prompt",
      recordExperiments: false,
      repetitions: 4,
      nextExperimentScaffold: undefined,
      instances: [instance],
    });
  });

  it("surfaces the staged scaffold and an evaluator page's kind", () => {
    const instance = getPlaygroundInstanceForAgent(
      makeInstance({ task: evaluatorTask("tone") }),
      position
    );

    const scaffold = getExperimentScaffoldForAgent({ name: "Run with notes" });

    expect(
      buildPlaygroundAgentContext({
        taskKind: "evaluator",
        recordExperiments: true,
        repetitions: 1,
        nextExperimentScaffold: scaffold,
        instances: [instance],
      })
    ).toEqual({
      type: "playground",
      taskKind: "evaluator",
      recordExperiments: true,
      repetitions: 1,
      nextExperimentScaffold: scaffold,
      instances: [instance],
    });
  });
});
