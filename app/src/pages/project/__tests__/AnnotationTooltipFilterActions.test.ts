import { describe, expect, it } from "vitest";

import { getAnnotationFilterDefinitions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";

describe("getAnnotationFilterDefinitions", () => {
  it("builds comparison filters for scores", () => {
    expect(
      getAnnotationFilterDefinitions({ name: "quality", score: 0.75 })
    ).toEqual([
      {
        filterName: "greater than",
        filterCondition: "annotations['quality'].score > 0.75",
        icon: "greater-than",
      },
      {
        filterName: "less than",
        filterCondition: "annotations['quality'].score < 0.75",
        icon: "less-than",
      },
      {
        filterName: "equals",
        filterCondition: "annotations['quality'].score == 0.75",
        icon: "equal",
      },
    ]);
  });

  it("preserves match and exclude filters for labels", () => {
    expect(
      getAnnotationFilterDefinitions({ name: "quality", label: "good" })
    ).toEqual([
      {
        filterName: "matches",
        filterCondition: "annotations['quality'].label == \"good\"",
        icon: "equal",
      },
      {
        filterName: "does not match",
        filterCondition: "annotations['quality'].label != \"good\"",
        icon: "not-equal",
      },
    ]);
  });
});
