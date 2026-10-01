import { describe, expect, it } from "vitest";

import { arePlaygroundInstancesEqualExceptProgress } from "../selectors";
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
        [{ ...base, task: { kind: "prompt" } as never }]
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
