import {
  formatQueueGrowthSummary,
  getMirroredCountAxis,
  getTotalNet,
} from "@phoenix/pages/evaluators/project-evaluators/queueThroughput";

function bin(
  groups: Array<{
    addedCount: number;
    evaluatedCount: number;
    failedCount?: number;
  }>
) {
  return {
    groups: groups.map(({ failedCount = 0, ...group }) => ({
      ...group,
      failedCount,
    })),
  };
}

describe("getMirroredCountAxis", () => {
  it.each([
    [0, 1, [-1, 0, 1]],
    [1, 1, [-1, 0, 1]],
    [3, 5, [-5, 0, 5]],
    [7, 10, [-10, -5, 0, 5, 10]],
    [1_200, 2_000, [-2_000, -1_000, 0, 1_000, 2_000]],
  ])(
    "rounds a busiest bin of %d up to %d, with whole-number ticks",
    (maxCount, extent, ticks) => {
      expect(getMirroredCountAxis(maxCount)).toEqual({ extent, ticks });
    }
  );
});

describe("getTotalNet", () => {
  it("sums added minus completed, counting failures as completed", () => {
    expect(
      getTotalNet([
        bin([{ addedCount: 10, evaluatedCount: 4, failedCount: 1 }]),
        bin([
          { addedCount: 2, evaluatedCount: 3 },
          { addedCount: 1, evaluatedCount: 0 },
        ]),
      ])
    ).toBe(5);
  });

  it("is null when nothing was added or completed", () => {
    expect(getTotalNet([bin([{ addedCount: 0, evaluatedCount: 0 }])])).toBe(
      null
    );
  });

  it("is zero when the queue kept pace", () => {
    expect(getTotalNet([bin([{ addedCount: 3, evaluatedCount: 3 }])])).toBe(0);
  });
});

describe("formatQueueGrowthSummary", () => {
  it("says whether the queue grew, shrank, or kept pace", () => {
    expect(formatQueueGrowthSummary(1_500)).toBe(
      "Queue grew by 1.5K in this range"
    );
    expect(formatQueueGrowthSummary(-20)).toBe(
      "Queue shrank by 20 in this range"
    );
    expect(formatQueueGrowthSummary(0)).toBe("Queue kept pace in this range");
    expect(formatQueueGrowthSummary(null)).toBeUndefined();
  });
});
