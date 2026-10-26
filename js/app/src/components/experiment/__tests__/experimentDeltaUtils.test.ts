import type { AnnotationConfig } from "@phoenix/components/annotation";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ExperimentRunMetricsSource } from "../experimentDeltaUtils";
import {
  computeLabelDelta,
  computeMeanPerRun,
  computeMetricDelta,
  computeOperationalMetricDelta,
  DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
  describeLabelDelta,
  describeMetricDelta,
  EXPERIMENT_RUN_METRICS,
  formatLabelDelta,
  formatMetricDelta,
  formatRelativeDelta,
  formatSignedMetricDelta,
  formatZeroDelta,
  getDeltaState,
  getExperimentRunMetricValue,
} from "../experimentDeltaUtils";

const statusConfig: AnnotationConfig = {
  name: "status",
  annotationType: "CATEGORICAL",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "ok", score: 1 },
    { label: "warning", score: 0.5 },
    { label: "error", score: 0 },
  ],
};

describe("computeMetricDelta", () => {
  it("is undefined when either side is missing", () => {
    expect(
      computeMetricDelta({
        base: null,
        compare: 1,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({ kind: "undefined" });
    expect(
      computeMetricDelta({
        base: 1,
        compare: undefined,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({ kind: "undefined" });
  });

  it("is unchanged when both sides are equal, including both 0", () => {
    expect(
      computeMetricDelta({
        base: 1.48,
        compare: 1.48,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({ kind: "unchanged" });
    expect(
      computeMetricDelta({
        base: 0,
        compare: 0,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({ kind: "unchanged" });
  });

  it("is unchanged when the sides differ only by floating-point noise", () => {
    expect(
      computeMetricDelta({
        base: (0.1 + 0.2 + 0.3) / 3,
        compare: (0.3 + 0.2 + 0.1) / 3,
        optimizationDirection: "MAXIMIZE",
      })
    ).toEqual({ kind: "unchanged" });
  });

  it("computes the absolute and relative change with the sign of the move", () => {
    expect(
      computeMetricDelta({
        base: 1.48,
        compare: 0.89,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({
      kind: "changed",
      absolute: expect.closeTo(-0.59, 10),
      relative: expect.closeTo(-0.59 / 1.48, 10),
      sign: "down",
      direction: "improved",
    });
  });

  it("marks a move in the bad direction as regressed", () => {
    expect(
      computeMetricDelta({
        base: 8,
        compare: 10,
        optimizationDirection: "MINIMIZE",
      })
    ).toMatchObject({ sign: "up", direction: "regressed" });
    expect(
      computeMetricDelta({
        base: 0.87,
        compare: 0.8,
        optimizationDirection: "MAXIMIZE",
      })
    ).toMatchObject({ sign: "down", direction: "regressed" });
  });

  it("is neutral without an optimization direction but keeps the sign", () => {
    expect(
      computeMetricDelta({
        base: 0.4,
        compare: 0.52,
        optimizationDirection: undefined,
      })
    ).toMatchObject({ sign: "up", direction: "neutral" });
  });

  it("measures the relative change against the magnitude of a negative base", () => {
    expect(
      computeMetricDelta({
        base: -2,
        compare: -1,
        optimizationDirection: "MAXIMIZE",
      })
    ).toMatchObject({ absolute: 1, relative: 0.5, direction: "improved" });
  });

  it("has no relative change when the base is 0", () => {
    expect(
      computeMetricDelta({
        base: 0,
        compare: 0.12,
        optimizationDirection: "MINIMIZE",
      })
    ).toEqual({
      kind: "changed",
      absolute: 0.12,
      relative: null,
      sign: "up",
      direction: "regressed",
    });
  });

  it("colors a change inside the neutral band neutral while keeping its value", () => {
    const delta = computeMetricDelta({
      base: 74_000,
      compare: 74_500,
      optimizationDirection: "MINIMIZE",
      neutralThreshold: DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
    });
    expect(delta).toMatchObject({
      kind: "changed",
      absolute: 500,
      sign: "up",
      direction: "neutral",
    });
  });

  it("colors a change at or past the neutral band", () => {
    expect(
      computeMetricDelta({
        base: 100,
        compare: 101,
        optimizationDirection: "MINIMIZE",
        neutralThreshold: DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
      })
    ).toMatchObject({ direction: "regressed" });
  });

  it("does not apply the neutral band to a 0 base", () => {
    expect(
      computeMetricDelta({
        base: 0,
        compare: 0.001,
        optimizationDirection: "MINIMIZE",
        neutralThreshold: DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
      })
    ).toMatchObject({ direction: "regressed" });
  });
});

describe("computeLabelDelta", () => {
  it("is undefined when either label is missing", () => {
    expect(computeLabelDelta({ baseLabel: null, compareLabel: "ok" })).toEqual({
      kind: "undefined",
    });
    expect(
      computeLabelDelta({ baseLabel: "ok", compareLabel: undefined })
    ).toEqual({ kind: "undefined" });
  });

  it("is unchanged for the same label", () => {
    expect(computeLabelDelta({ baseLabel: "ok", compareLabel: "ok" })).toEqual({
      kind: "unchanged",
      label: "ok",
    });
  });

  it("resolves the direction from the config's label scores", () => {
    expect(
      computeLabelDelta({
        baseLabel: "ok",
        compareLabel: "error",
        config: statusConfig,
      })
    ).toEqual({
      kind: "changed",
      baseLabel: "ok",
      compareLabel: "error",
      direction: "regressed",
    });
    expect(
      computeLabelDelta({
        baseLabel: "error",
        compareLabel: "ok",
        config: statusConfig,
      })
    ).toMatchObject({ direction: "improved" });
  });

  it("is neutral without a config, without label scores, or with direction NONE", () => {
    expect(
      computeLabelDelta({ baseLabel: "ok", compareLabel: "error" })
    ).toMatchObject({ kind: "changed", direction: "neutral" });
    expect(
      computeLabelDelta({
        baseLabel: "ok",
        compareLabel: "error",
        config: {
          ...statusConfig,
          values: [
            { label: "ok", score: null },
            { label: "error", score: null },
          ],
        },
      })
    ).toMatchObject({ direction: "neutral" });
    expect(
      computeLabelDelta({
        baseLabel: "ok",
        compareLabel: "error",
        config: { ...statusConfig, optimizationDirection: "NONE" },
      })
    ).toMatchObject({ direction: "neutral" });
  });

  it("is neutral when both labels score the same", () => {
    expect(
      computeLabelDelta({
        baseLabel: "ok",
        compareLabel: "pass",
        config: {
          ...statusConfig,
          values: [
            { label: "ok", score: 1 },
            { label: "pass", score: 1 },
          ],
        },
      })
    ).toMatchObject({ direction: "neutral" });
  });
});

describe("computeMeanPerRun", () => {
  it("divides the total by the run count", () => {
    expect(computeMeanPerRun({ total: 300, runCount: 3 })).toBe(100);
  });

  it("is null without a total or without runs", () => {
    expect(computeMeanPerRun({ total: null, runCount: 3 })).toBeNull();
    expect(computeMeanPerRun({ total: 300, runCount: 0 })).toBeNull();
  });
});

describe("getExperimentRunMetricValue", () => {
  const experiment: ExperimentRunMetricsSource = {
    runCount: 4,
    averageRunLatencyMs: 1_500,
    errorRate: 0.25,
    costSummary: { total: { cost: 2, tokens: 1_000 } },
  };

  it("reads latency and error rate as they are", () => {
    expect(getExperimentRunMetricValue({ experiment, metric: "latency" })).toBe(
      1_500
    );
    expect(
      getExperimentRunMetricValue({ experiment, metric: "errorRate" })
    ).toBe(0.25);
  });

  it("divides token and cost totals by the run count", () => {
    expect(getExperimentRunMetricValue({ experiment, metric: "tokens" })).toBe(
      250
    );
    expect(getExperimentRunMetricValue({ experiment, metric: "cost" })).toBe(
      0.5
    );
  });

  it("is null without runs, totals or an error rate", () => {
    const empty: ExperimentRunMetricsSource = {
      runCount: 0,
      averageRunLatencyMs: null,
      costSummary: { total: { cost: null, tokens: null } },
    };
    expect(
      getExperimentRunMetricValue({ experiment: empty, metric: "tokens" })
    ).toBeNull();
    expect(
      getExperimentRunMetricValue({ experiment: empty, metric: "cost" })
    ).toBeNull();
    expect(
      getExperimentRunMetricValue({ experiment: empty, metric: "errorRate" })
    ).toBeNull();
    expect(
      getExperimentRunMetricValue({
        experiment: { ...experiment, runCount: 0 },
        metric: "cost",
      })
    ).toBeNull();
  });

  it("compares totals per run so a different run count is no change", () => {
    const halfTheRuns: ExperimentRunMetricsSource = {
      ...experiment,
      runCount: 2,
      costSummary: { total: { cost: 1, tokens: 500 } },
    };
    expect(
      computeOperationalMetricDelta({
        base: getExperimentRunMetricValue({ experiment, metric: "cost" }),
        compare: getExperimentRunMetricValue({
          experiment: halfTheRuns,
          metric: "cost",
        }),
      })
    ).toEqual({ kind: "unchanged" });
  });

  it("shows an error rate rising from zero in percentage points", () => {
    const delta = computeOperationalMetricDelta({
      base: getExperimentRunMetricValue({
        experiment: { ...experiment, errorRate: 0 },
        metric: "errorRate",
      }),
      compare: getExperimentRunMetricValue({
        experiment: { ...experiment, errorRate: 0.04 },
        metric: "errorRate",
      }),
    });
    expect(delta).toMatchObject({
      kind: "changed",
      sign: "up",
      direction: "regressed",
      relative: null,
    });
    expect(
      formatMetricDelta({
        delta,
        display: EXPERIMENT_RUN_METRICS.errorRate.display,
        formatter: EXPERIMENT_RUN_METRICS.errorRate.formatter,
      })
    ).toBe("4.00%");
  });
});

describe("formatRelativeDelta", () => {
  it("formats an unsigned percentage, with a decimal only under 10%", () => {
    expect(formatRelativeDelta(-0.364)).toBe("36%");
    expect(formatRelativeDelta(0.0068)).toBe("0.7%");
    expect(formatRelativeDelta(0.0001)).toBe("<0.1%");
  });
});

describe("formatMetricDelta", () => {
  const improved = computeMetricDelta({
    base: 1.48,
    compare: 0.89,
    optimizationDirection: "MINIMIZE",
  });

  it("shows the relative change by default and the absolute change on request", () => {
    expect(
      formatMetricDelta({
        delta: improved,
        display: "relative",
        formatter: costFormatter,
      })
    ).toBe("40%");
    expect(
      formatMetricDelta({
        delta: improved,
        display: "absolute",
        formatter: costFormatter,
      })
    ).toBe("$0.59");
  });

  it("falls back to the absolute change when the base is 0", () => {
    const fromZero = computeMetricDelta({
      base: 0,
      compare: 0.12,
      optimizationDirection: "MINIMIZE",
    });
    expect(
      formatMetricDelta({
        delta: fromZero,
        display: "relative",
        formatter: costFormatter,
      })
    ).toBe("$0.12");
  });

  it("uses text rather than symbols for unchanged and undefined", () => {
    expect(
      formatMetricDelta({ delta: { kind: "unchanged" }, display: "relative" })
    ).toBe("no change");
    expect(
      formatMetricDelta({ delta: { kind: "undefined" }, display: "relative" })
    ).toBe("--");
  });
});

describe("formatZeroDelta", () => {
  it("formats zero in the column's display", () => {
    expect(formatZeroDelta({ display: "relative" })).toBe("0%");
    expect(
      formatZeroDelta({ display: "absolute", formatter: costFormatter })
    ).toBe("$0");
    expect(formatZeroDelta({ display: "absolute" })).toBe("0");
  });
});

describe("formatSignedMetricDelta", () => {
  it("pairs the signed absolute change with the signed relative change", () => {
    const delta = computeMetricDelta({
      base: 1.48,
      compare: 0.89,
      optimizationDirection: "MINIMIZE",
    });
    if (delta.kind !== "changed") throw new Error("expected a change");
    expect(formatSignedMetricDelta({ delta, formatter: costFormatter })).toBe(
      "−$0.59 (−40%)"
    );
  });

  it("omits the relative change when the base is 0", () => {
    const delta = computeMetricDelta({
      base: 0,
      compare: 2,
      optimizationDirection: "MINIMIZE",
    });
    if (delta.kind !== "changed") throw new Error("expected a change");
    expect(formatSignedMetricDelta({ delta })).toBe("+2");
  });
});

describe("describeMetricDelta", () => {
  it("builds the sentence from the same delta the token shows", () => {
    expect(
      describeMetricDelta({
        metricLabel: "Total cost",
        delta: computeMetricDelta({
          base: 1.48,
          compare: 0.89,
          optimizationDirection: "MINIMIZE",
        }),
        display: "relative",
        formatter: costFormatter,
      })
    ).toBe("Total cost decreased 40% vs base (improved)");
    expect(
      describeMetricDelta({
        metricLabel: "coverage",
        delta: computeMetricDelta({
          base: 0.4,
          compare: 0.52,
          optimizationDirection: undefined,
        }),
        display: "absolute",
      })
    ).toBe("coverage increased 0.12 vs base");
  });

  it("describes unchanged and undefined deltas", () => {
    expect(
      describeMetricDelta({
        metricLabel: "reward",
        delta: { kind: "unchanged" },
        display: "absolute",
      })
    ).toBe("reward unchanged vs base");
    expect(
      describeMetricDelta({
        metricLabel: "coverage",
        delta: { kind: "undefined" },
        display: "absolute",
      })
    ).toBe("No comparison available for coverage");
  });
});

describe("label delta text", () => {
  it("names the previous label and the direction", () => {
    const delta = computeLabelDelta({
      baseLabel: "ok",
      compareLabel: "error",
      config: statusConfig,
    });
    expect(formatLabelDelta(delta)).toBe("was ok");
    expect(describeLabelDelta({ annotationName: "status", delta })).toBe(
      "status label changed from ok to error (regressed)"
    );
  });

  it("uses text rather than symbols for unchanged and undefined", () => {
    expect(formatLabelDelta({ kind: "unchanged", label: "ok" })).toBe(
      "no change"
    );
    expect(
      describeLabelDelta({
        annotationName: "status",
        delta: { kind: "unchanged", label: "ok" },
      })
    ).toBe("status label unchanged vs base: ok");
    expect(formatLabelDelta({ kind: "undefined" })).toBe("--");
  });
});

describe("getDeltaState", () => {
  it("names the direction of a change and the kind otherwise", () => {
    expect(
      getDeltaState(
        computeMetricDelta({
          base: 1,
          compare: 2,
          optimizationDirection: "MAXIMIZE",
        })
      )
    ).toBe("improved");
    expect(getDeltaState({ kind: "unchanged" })).toBe("unchanged");
    expect(getDeltaState({ kind: "undefined" })).toBe("undefined");
  });
});
