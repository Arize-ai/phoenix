import type { AnnotationMetricsSeries } from "@phoenix/components/chart/annotationMetricsUtils";
import { CATEGORICAL_CHART_COLORS } from "@phoenix/components/chart/colors";
import {
  getCompareLabelSegments,
  getLabelDisplayOrder,
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
