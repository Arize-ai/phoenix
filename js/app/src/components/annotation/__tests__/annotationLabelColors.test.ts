import { describe, expect, it } from "vitest";

import {
  extendAnnotationLabelColors,
  getAnnotationLabelColor,
  getAnnotationLabelOrder,
} from "../annotationLabelColors";

const COLORS = ["primary", "gray1", "gray2"];

describe("getAnnotationLabelOrder", () => {
  it("orders a categorical config's labels best score first", () => {
    expect(
      getAnnotationLabelOrder({
        annotationType: "CATEGORICAL",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "no", score: 0 },
          { label: "yes", score: 1 },
        ],
      })
    ).toEqual(["yes", "no"]);
    expect(
      getAnnotationLabelOrder({
        annotationType: "CATEGORICAL",
        optimizationDirection: "MINIMIZE",
        values: [
          { label: "toxic", score: 1 },
          { label: "safe", score: 0 },
        ],
      })
    ).toEqual(["safe", "toxic"]);
  });

  it("keeps config order for unscored labels", () => {
    expect(
      getAnnotationLabelOrder({
        annotationType: "CATEGORICAL",
        optimizationDirection: "NONE",
        values: [
          { label: "positive", score: null },
          { label: "neutral", score: null },
          { label: "negative", score: null },
        ],
      })
    ).toEqual(["positive", "neutral", "negative"]);
  });

  it("is null without a categorical config", () => {
    expect(getAnnotationLabelOrder(undefined)).toBeNull();
    expect(
      getAnnotationLabelOrder({
        annotationType: "CONTINUOUS",
        optimizationDirection: "MAXIMIZE",
      })
    ).toBeNull();
  });
});

describe("getAnnotationLabelColor", () => {
  const config = {
    annotationType: "CATEGORICAL" as const,
    optimizationDirection: "MAXIMIZE" as const,
    values: [
      { label: "no", score: 0 },
      { label: "yes", score: 1 },
    ],
  };

  it("colors a label by its config place, whatever its list position", () => {
    expect(getAnnotationLabelColor(COLORS, 1, "yes", config)).toBe("primary");
    expect(getAnnotationLabelColor(COLORS, 0, "no", config)).toBe("gray1");
  });

  it("falls back to the list position for an unlisted label or no config", () => {
    expect(getAnnotationLabelColor(COLORS, 2, "maybe", config)).toBe("gray2");
    expect(getAnnotationLabelColor(COLORS, 4, "yes")).toBe("gray1");
  });
});

describe("extendAnnotationLabelColors", () => {
  it("cycles the colors after the first so it never repeats", () => {
    expect(extendAnnotationLabelColors(COLORS, 6)).toEqual([
      "primary",
      "gray1",
      "gray2",
      "gray1",
      "gray2",
      "gray1",
    ]);
  });

  it("returns the palette as is when it already covers the labels", () => {
    expect(extendAnnotationLabelColors(COLORS, 2)).toBe(COLORS);
  });
});
