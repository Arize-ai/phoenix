import {
  formatQueueGrowthSummary,
  getMirroredCountAxis,
  getQueueSizeRows,
  getQueueThroughputRows,
  getTotalNet,
} from "@phoenix/pages/project/metrics/queueThroughput";

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

describe("queue chart rows", () => {
  const FIRST_BIN = "2026-11-19T10:00:00Z";
  const SECOND_BIN = "2026-11-19T11:00:00Z";
  const bins = [
    {
      timestamp: FIRST_BIN,
      ...bin([
        { addedCount: 4, evaluatedCount: 1, failedCount: 1 },
        { addedCount: 2, evaluatedCount: 3 },
      ]),
    },
    { timestamp: SECOND_BIN, ...bin([]) },
  ];
  const queueSizeByTimestamp = new Map([[Date.parse(FIRST_BIN), 9]]);

  it("sums each bin's groups for the throughput chart, failures as completed", () => {
    expect(getQueueThroughputRows({ bins, queueSizeByTimestamp })).toEqual([
      {
        timestamp: Date.parse(FIRST_BIN),
        added: 6,
        completed: 5,
        queueSize: 9,
      },
      {
        timestamp: Date.parse(SECOND_BIN),
        added: 0,
        completed: 0,
        queueSize: 0,
      },
    ]);
  });

  it("pairs each bin's queue size with what it processed", () => {
    expect(getQueueSizeRows({ bins, queueSizeByTimestamp })).toEqual([
      { timestamp: Date.parse(FIRST_BIN), queueSize: 9, processed: 5 },
      { timestamp: Date.parse(SECOND_BIN), queueSize: 0, processed: 0 },
    ]);
  });
});
