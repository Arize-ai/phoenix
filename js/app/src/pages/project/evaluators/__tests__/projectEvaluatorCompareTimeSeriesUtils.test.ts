import type { AnnotationMetricsSeries } from "@phoenix/components/chart/annotationMetricsUtils";
import {
  getCompareLabelSegments,
  getLabelDisplayOrder,
  getCompareTimeSeriesView,
  getCompareTimeSeriesViews,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareTimeSeriesUtils";
import { NEUTRAL_LABEL_COLOR } from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";

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
    const segments = getCompareLabelSegments({
      labels: ["fail", "unknown", "pass"],
      hue: "blue",
      config: {
        annotationType: "CATEGORICAL",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "pass", score: 1 },
          { label: "fail", score: 0 },
        ],
      },
    });
    expect(segments).toEqual([
      { label: "pass", index: 2, color: "var(--global-color-blue-900)" },
      { label: "fail", index: 0, color: "var(--global-color-blue-400)" },
      { label: "unknown", index: 1, color: NEUTRAL_LABEL_COLOR },
    ]);
  });

  it("steps through the same shades in display order without a direction", () => {
    const segments = getCompareLabelSegments({
      labels: ["y", "x"],
      hue: "orange",
      config: { annotationType: "CATEGORICAL", optimizationDirection: "NONE" },
    });
    expect(segments).toEqual([
      { label: "x", index: 1, color: "var(--global-color-orange-900)" },
      { label: "y", index: 0, color: "var(--global-color-orange-400)" },
    ]);
  });
});
