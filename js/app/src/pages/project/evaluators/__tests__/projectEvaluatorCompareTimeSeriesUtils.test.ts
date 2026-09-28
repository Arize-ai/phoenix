import type { AnnotationMetricsSeries } from "@phoenix/components/chart/annotationMetricsUtils";
import { CATEGORICAL_CHART_COLORS } from "@phoenix/components/chart/colors";
import {
  getCompareLabelSegments,
  getLabelDisplayOrder,
  mergeSummaryBins,
  getCompareTimeSeriesView,
  getCompareTimeSeriesViews,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareTimeSeriesUtils";
import { NEUTRAL_LABEL_COLOR } from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";

// Each palette slot "colors" as its own name, so assertions read the slot.
const categoryColors = Object.fromEntries(
  CATEGORICAL_CHART_COLORS.map((name) => [name, name])
) as Parameters<typeof getCompareLabelSegments>[0]["categoryColors"];

function series(
  values: Partial<AnnotationMetricsSeries> = {}
): AnnotationMetricsSeries {
  return { name: "name", views: ["scores"], labels: [], data: [], ...values };
}

describe("getCompareTimeSeriesViews", () => {
  it("unions both sides with scores first", () => {
    expect(
      getCompareTimeSeriesViews([
        series({ views: ["labels"] }),
        series({ views: ["labels", "scores"] }),
      ])
    ).toEqual(["scores", "labels"]);
    expect(getCompareTimeSeriesViews([undefined, undefined])).toEqual([]);
  });
});

describe("getCompareTimeSeriesView", () => {
  it("honors an available request and falls back to the first view", () => {
    expect(
      getCompareTimeSeriesView({
        views: ["scores", "labels"],
        requested: "labels",
      })
    ).toBe("labels");
    expect(
      getCompareTimeSeriesView({ views: ["labels"], requested: "scores" })
    ).toBe("labels");
    expect(getCompareTimeSeriesView({ views: [], requested: null })).toBe(
      "scores"
    );
  });
});

describe("getLabelDisplayOrder", () => {
  it("puts configured labels first, then the rest alphabetically", () => {
    expect(
      getLabelDisplayOrder({
        labels: ["zeta", "fail", "alpha", "pass"],
        configuredLabels: ["pass", "fail"],
      })
    ).toEqual(["pass", "fail", "alpha", "zeta"]);
  });
});

describe("getCompareLabelSegments", () => {
  it("orders labels most optimal first and shades by optimality", () => {
    const { segments, hasOptimization } = getCompareLabelSegments({
      labels: ["fail", "unknown", "pass"],
      color: "red",
      direction: "MAXIMIZE",
      scoresByLabel: new Map([
        ["pass", 1],
        ["fail", 0],
      ]),
      categoryColors,
    });
    expect(hasOptimization).toBe(true);
    expect(segments).toEqual([
      {
        label: "pass",
        index: 2,
        color: `color-mix(in oklch, red 100%, ${NEUTRAL_LABEL_COLOR})`,
      },
      {
        label: "fail",
        index: 0,
        color: `color-mix(in oklch, red 30%, ${NEUTRAL_LABEL_COLOR})`,
      },
      { label: "unknown", index: 1, color: NEUTRAL_LABEL_COLOR },
    ]);
  });

  it("uses the categorical palette in display order without a direction", () => {
    const { segments, hasOptimization } = getCompareLabelSegments({
      labels: ["y", "x"],
      color: "red",
      direction: "NONE",
      scoresByLabel: new Map(),
      categoryColors,
    });
    expect(hasOptimization).toBe(false);
    expect(segments).toEqual([
      { label: "x", index: 1, color: CATEGORICAL_CHART_COLORS[0] },
      { label: "y", index: 0, color: CATEGORICAL_CHART_COLORS[1] },
    ]);
  });
});

describe("mergeSummaryBins", () => {
  const minute = (index: number) =>
    new Date(Date.UTC(2026, 0, 1, 14, index)).toISOString();

  function bin(
    index: number,
    summaries: Parameters<
      typeof mergeSummaryBins
    >[0]["bins"][number]["annotationSummaries"] = []
  ) {
    return { timestamp: minute(index), annotationSummaries: summaries };
  }

  it("keeps bins as they are when they already fit", () => {
    const merged = mergeSummaryBins({
      bins: [bin(0), bin(1)],
      scale: "MINUTE",
      utcOffsetMinutes: 0,
    });
    expect(merged.binMs).toBe(60_000);
    expect(merged.points.map(({ x }) => x)).toEqual([
      Date.parse(minute(0)),
      Date.parse(minute(1)),
    ]);
  });

  it("merges an hour of minutes into clock-aligned 5-minute bins", () => {
    const merged = mergeSummaryBins({
      bins: Array.from({ length: 60 }, (_, index) => bin(index)),
      scale: "MINUTE",
      utcOffsetMinutes: 0,
    });
    expect(merged.binMs).toBe(5 * 60_000);
    expect(merged.points).toHaveLength(12);
    expect(merged.points[1]?.x).toBe(Date.parse(minute(5)));
  });

  it("weights shares by result count and means by scored count", () => {
    const merged = mergeSummaryBins({
      bins: [
        bin(0, [
          {
            name: "a",
            count: 1,
            scoreCount: 1,
            meanScore: 1,
            labelFractions: [{ label: "pass", fraction: 1 }],
          },
        ]),
        bin(1, [
          {
            name: "a",
            count: 3,
            scoreCount: 3,
            meanScore: 0,
            labelFractions: [{ label: "fail", fraction: 1 }],
          },
        ]),
      ],
      scale: "MINUTE",
      utcOffsetMinutes: 0,
      maxBins: 1,
    });
    expect(merged.points).toHaveLength(1);
    const [summary] = merged.points[0]?.summaries ?? [];
    expect(summary?.meanScore).toBeCloseTo(0.25);
    expect(summary?.labelFractions).toEqual([
      { label: "pass", fraction: 0.25 },
      { label: "fail", fraction: 0.75 },
    ]);
  });
});
