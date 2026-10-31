import { describe, expect, it } from "vitest";

import type {
  EvaluatorActivityBinGroup,
  EvaluatorActivityGroup,
} from "../evaluatorActivity";
import {
  getDurationTicks,
  getEvaluatorCostRanking,
  getEvaluatorSeries,
  getEvaluatorTimeSeriesRows,
  getQueueSizeRows,
  OTHER_EVALUATORS_DATA_KEY,
} from "../evaluatorActivity";

const group = (
  id: string | null,
  overrides: Partial<EvaluatorActivityGroup> = {}
): EvaluatorActivityGroup => ({
  projectEvaluator: id == null ? null : { id, name: `${id}-name` },
  evaluatedCount: 0,
  failedCount: 0,
  cost: null,
  ...overrides,
});

const binGroup = (
  id: string | null,
  overrides: Partial<EvaluatorActivityBinGroup> = {}
): EvaluatorActivityBinGroup => ({
  projectEvaluator: id == null ? null : { id },
  evaluatedCount: 0,
  failedCount: 0,
  lagP95Seconds: null,
  cost: null,
  queueSize: 0,
  ...overrides,
});

describe("getEvaluatorSeries", () => {
  it("orders evaluators by evaluations run and folds the rest past the palette", () => {
    const { series, getDataKey } = getEvaluatorSeries({
      groups: [
        group("a", { evaluatedCount: 1 }),
        group("b", { evaluatedCount: 5, failedCount: 5 }),
        group("c", { evaluatedCount: 3 }),
        group(null, { evaluatedCount: 100 }),
      ],
      paletteSize: 2,
    });
    expect(series).toEqual([
      { dataKey: "evaluator0", name: "b-name", colorIndex: 0 },
      { dataKey: "evaluator1", name: "c-name", colorIndex: 1 },
      {
        dataKey: OTHER_EVALUATORS_DATA_KEY,
        name: "Other evaluators",
        colorIndex: null,
      },
    ]);
    expect(getDataKey("b")).toBe("evaluator0");
    expect(getDataKey("a")).toBe(OTHER_EVALUATORS_DATA_KEY);
    expect(getDataKey(null)).toBe(OTHER_EVALUATORS_DATA_KEY);
  });

  it("adds no other series when every evaluator gets a color", () => {
    const { series } = getEvaluatorSeries({
      groups: [group("a"), group("b")],
      paletteSize: 2,
    });
    expect(series.map(({ dataKey }) => dataKey)).toEqual([
      "evaluator0",
      "evaluator1",
    ]);
  });
});

describe("getEvaluatorTimeSeriesRows", () => {
  const { series, getDataKey } = getEvaluatorSeries({
    groups: [
      group("a", { evaluatedCount: 2 }),
      group("b", { evaluatedCount: 1 }),
      group("c"),
    ],
    paletteSize: 1,
  });
  const bins = [
    {
      timestamp: "2026-10-28T10:00:00Z",
      groups: [
        binGroup("a", { evaluatedCount: 2, lagP95Seconds: 30 }),
        binGroup("b", { evaluatedCount: 1, lagP95Seconds: 90 }),
        binGroup("c", { evaluatedCount: 4, lagP95Seconds: 60 }),
      ],
    },
    { timestamp: "2026-10-28T11:00:00Z", groups: [] },
  ];

  it("sums counts into folded series and reads 0 where a series is absent", () => {
    expect(
      getEvaluatorTimeSeriesRows({
        bins,
        series,
        getDataKey,
        metric: "evaluatedCount",
      })
    ).toEqual([
      {
        timestamp: Date.parse("2026-10-28T10:00:00Z"),
        evaluator0: 2,
        [OTHER_EVALUATORS_DATA_KEY]: 5,
      },
      {
        timestamp: Date.parse("2026-10-28T11:00:00Z"),
        evaluator0: 0,
        [OTHER_EVALUATORS_DATA_KEY]: 0,
      },
    ]);
  });

  it("takes the slowest folded lag and leaves bins with no results empty", () => {
    expect(
      getEvaluatorTimeSeriesRows({
        bins,
        series,
        getDataKey,
        metric: "lagP95Seconds",
      })
    ).toEqual([
      {
        timestamp: Date.parse("2026-10-28T10:00:00Z"),
        evaluator0: 30,
        [OTHER_EVALUATORS_DATA_KEY]: 90,
      },
      {
        timestamp: Date.parse("2026-10-28T11:00:00Z"),
        evaluator0: null,
        [OTHER_EVALUATORS_DATA_KEY]: null,
      },
    ]);
  });
});

describe("getQueueSizeRows", () => {
  it("adds up every evaluator's queue at the end of each bin", () => {
    expect(
      getQueueSizeRows([
        {
          timestamp: "2026-10-28T10:00:00Z",
          groups: [
            binGroup("a", { queueSize: 3 }),
            binGroup("b", { queueSize: 4 }),
          ],
        },
      ])
    ).toEqual([
      { timestamp: Date.parse("2026-10-28T10:00:00Z"), queueSize: 7 },
    ]);
  });
});

describe("getEvaluatorCostRanking", () => {
  it("ranks series by cost with their share of the total", () => {
    const groups = [
      group("a", { evaluatedCount: 3, cost: 1 }),
      group("b", { evaluatedCount: 2, cost: 3 }),
      group("c", { evaluatedCount: 1, cost: null }),
    ];
    const { series, getDataKey } = getEvaluatorSeries({
      groups,
      paletteSize: 12,
    });
    expect(getEvaluatorCostRanking({ groups, series, getDataKey })).toEqual([
      { dataKey: "evaluator1", name: "b-name", cost: 3, share: 75 },
      { dataKey: "evaluator0", name: "a-name", cost: 1, share: 25 },
    ]);
  });
});

describe("getDurationTicks", () => {
  it("steps lag ticks on whole durations", () => {
    expect(getDurationTicks(1400)).toEqual([0, 600, 1200, 1800]);
    expect(getDurationTicks(600)).toEqual([0, 300, 600]);
    expect(getDurationTicks(45)).toEqual([0, 15, 30, 45]);
  });
});
