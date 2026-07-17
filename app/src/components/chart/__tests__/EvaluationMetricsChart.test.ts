import { describe, expect, it } from "vitest";

import {
  getEvaluationHiddenDataKeys,
  getEvaluationLegendItemId,
} from "../EvaluationMetricsChart";

describe("evaluation metrics legend state", () => {
  it("keeps a hidden label attached to its identity when labels reorder", () => {
    const hiddenLabelId = getEvaluationLegendItemId({
      dataKey: "fractions.0",
      visibleLabels: ["alpha", "beta"],
    });
    expect(hiddenLabelId).toBe("label:alpha");

    const hiddenDataKeys = getEvaluationHiddenDataKeys({
      hiddenLegendItemIds: new Set([hiddenLabelId as string]),
      visibleLabels: ["beta", "alpha"],
    });

    expect(hiddenDataKeys).toEqual(new Set(["fractions.1"]));
  });

  it("keeps mean score state independent from label identities", () => {
    const hiddenMeanScoreId = getEvaluationLegendItemId({
      dataKey: "meanScore",
      visibleLabels: ["alpha"],
    });

    expect(
      getEvaluationHiddenDataKeys({
        hiddenLegendItemIds: new Set([hiddenMeanScoreId as string]),
        visibleLabels: ["beta"],
      })
    ).toEqual(new Set(["meanScore"]));
  });
});
