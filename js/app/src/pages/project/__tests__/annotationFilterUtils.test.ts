import { describe, expect, it } from "vitest";

import {
  getAnnotationTooltipFilters,
  getTraceSpanAnnotationTooltipFilters,
} from "../annotationFilterUtils";

describe("getAnnotationTooltipFilters", () => {
  it("escapes annotation names and numeric score filters", () => {
    expect(
      getAnnotationTooltipFilters({ name: "judge's score", score: 0.5 })
    ).toEqual([
      {
        filterName: "greater than",
        filterCondition: "annotations['judge\\'s score'].score > 0.5",
      },
      {
        filterName: "less than",
        filterCondition: "annotations['judge\\'s score'].score < 0.5",
      },
      {
        filterName: "equals",
        filterCondition: "annotations['judge\\'s score'].score == 0.5",
      },
    ]);
  });

  it("escapes labels and includes missing annotations in exclude filters", () => {
    expect(
      getAnnotationTooltipFilters({ name: "quality", label: 'say "yes"\\' })
    ).toEqual([
      {
        filterName: "match",
        filterCondition:
          'annotations[\'quality\'].label == "say \\"yes\\"\\\\"',
      },
      {
        filterName: "exclude",
        filterCondition:
          "(annotations['quality'].label != \"say \\\"yes\\\"\\\\\" or annotations['quality'].label is None)",
      },
    ]);
  });
});

describe("getTraceSpanAnnotationTooltipFilters", () => {
  it("targets matching annotations on any span in the trace", () => {
    expect(
      getTraceSpanAnnotationTooltipFilters({
        name: "quality",
        label: "accepted",
      })
    ).toEqual([
      {
        filterName: "match",
        filterCondition:
          "any(any(annotation.name == 'quality' and annotation.label == \"accepted\" for annotation in span.annotations) for span in spans)",
      },
      {
        filterName: "exclude",
        filterCondition:
          "not any(any(annotation.name == 'quality' and annotation.label == \"accepted\" for annotation in span.annotations) for span in spans)",
      },
    ]);
  });
});
