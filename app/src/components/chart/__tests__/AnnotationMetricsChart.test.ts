import { describe, expect, it } from "vitest";

import {
  getAnnotationHiddenDataKeys,
  getAnnotationLegendItemId,
} from "../AnnotationMetricsChart";

describe("annotation metrics legend state", () => {
  it("keeps a hidden label attached to its identity when labels reorder", () => {
    const hiddenLabelId = getAnnotationLegendItemId({
      dataKey: "fractions.0",
      visibleLabels: ["alpha", "beta"],
    });
    expect(hiddenLabelId).toBe("label:alpha");

    const hiddenDataKeys = getAnnotationHiddenDataKeys({
      hiddenLegendItemIds: new Set([hiddenLabelId as string]),
      visibleLabels: ["beta", "alpha"],
    });

    expect(hiddenDataKeys).toEqual(new Set(["fractions.1"]));
  });
});
