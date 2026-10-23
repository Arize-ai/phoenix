import { describe, expect, it } from "vitest";

import { createDecisionDraft } from "@phoenix/pages/playground/decisionUtils";

import {
  createDecisionTaskInstance,
  createPlaygroundStore,
} from "../playgroundStore";
import {
  arePlaygroundInstancesEqualExceptProgress,
  arePlaygroundInstancesEqualExceptProgressAndDecisionDraft,
} from "../selectors";
import type { PlaygroundNormalizedInstance } from "../types";

// The comparison reads keys, not shapes, so a sketch of an instance is enough.
function instance(
  overrides: Partial<PlaygroundNormalizedInstance> = {}
): PlaygroundNormalizedInstance {
  return {
    id: 1,
    activeRunId: null,
    experiment: null,
    experimentRunProgress: null,
    ...overrides,
  } as PlaygroundNormalizedInstance;
}

describe("arePlaygroundInstancesEqualExceptProgress", () => {
  it("treats the same array, and arrays of the same instances, as equal", () => {
    const instances = [instance(), instance({ id: 2 })];

    expect(
      arePlaygroundInstancesEqualExceptProgress(instances, instances)
    ).toBe(true);
    expect(
      arePlaygroundInstancesEqualExceptProgress(instances, [...instances])
    ).toBe(true);
  });

  it("ignores a change to the run progress alone", () => {
    const before = instance({
      experimentRunProgress: {
        totalRuns: 4,
        runsCompleted: 1,
        runsFailed: 0,
        totalEvals: 0,
        evalsCompleted: 0,
        evalsFailed: 0,
      },
    });
    const after = {
      ...before,
      experimentRunProgress: {
        ...before.experimentRunProgress!,
        runsCompleted: 2,
      },
    };

    expect(arePlaygroundInstancesEqualExceptProgress([before], [after])).toBe(
      true
    );
  });

  it("sees any other change: a run starting, an experiment landing, a task edit", () => {
    const base = instance();

    expect(
      arePlaygroundInstancesEqualExceptProgress(
        [base],
        [{ ...base, activeRunId: 7 }]
      )
    ).toBe(false);
    expect(
      arePlaygroundInstancesEqualExceptProgress(
        [base],
        [{ ...base, experiment: { id: "E1" } as never }]
      )
    ).toBe(false);
    expect(
      arePlaygroundInstancesEqualExceptProgress(
        [base],
        [{ ...base, task: { type: "prompt" } as never }]
      )
    ).toBe(false);
  });

  it("sees instances added or removed", () => {
    const base = instance();

    expect(
      arePlaygroundInstancesEqualExceptProgress(
        [base],
        [base, instance({ id: 2 })]
      )
    ).toBe(false);
    expect(arePlaygroundInstancesEqualExceptProgress([base], [])).toBe(false);
  });
});

describe("arePlaygroundInstancesEqualExceptProgressAndDecisionDraft", () => {
  it("ignores a decision draft edit and a progress bump", () => {
    const before = instance({ decisionRequest: createDecisionDraft() });
    const after = {
      ...before,
      decisionRequest: { ...before.decisionRequest!, state: "typed" },
      experimentRunProgress: {
        totalRuns: 1,
        runsCompleted: 1,
        runsFailed: 0,
        totalEvals: 0,
        evalsCompleted: 0,
        evalsFailed: 0,
      },
    };

    expect(
      arePlaygroundInstancesEqualExceptProgressAndDecisionDraft(
        [before],
        [after]
      )
    ).toBe(true);
    // Without the draft exemption the same edit is a change.
    expect(arePlaygroundInstancesEqualExceptProgress([before], [after])).toBe(
      false
    );
  });

  it("sees any other change", () => {
    const base = instance();

    expect(
      arePlaygroundInstancesEqualExceptProgressAndDecisionDraft(
        [base],
        [{ ...base, activeRunId: 7 }]
      )
    ).toBe(false);
    expect(
      arePlaygroundInstancesEqualExceptProgressAndDecisionDraft(
        [base],
        [{ ...base, task: { type: "decision" } as never }]
      )
    ).toBe(false);
    expect(
      arePlaygroundInstancesEqualExceptProgressAndDecisionDraft([base], [])
    ).toBe(false);
  });

  // The dataset table subscribes with this equality; typing in a decision
  // must not rebuild its columns, or the whole table re-renders per keystroke.
  it("holds across a store decision edit", () => {
    const draft = createDecisionDraft();
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      instances: [
        { ...createDecisionTaskInstance(), id: 1, decisionRequest: draft },
      ],
    });
    const before = store.getState().instances;

    store.getState().updateDecisionRequest({
      instanceId: 1,
      request: { ...draft, state: "Typed {{ticket}}" },
    });
    const after = store.getState().instances;

    expect(after).not.toBe(before);
    expect(
      arePlaygroundInstancesEqualExceptProgressAndDecisionDraft(before, after)
    ).toBe(true);
  });
});
