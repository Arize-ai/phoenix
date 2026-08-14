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

  it("builds trace annotation score filters", () => {
    expect(
      getAnnotationTooltipFilters({
        accessor: "trace_annotations",
        name: "quality",
        score: 0.5,
      })
    ).toEqual([
      {
        filterName: "greater than",
        filterCondition: "trace_annotations['quality'].score > 0.5",
      },
      {
        filterName: "less than",
        filterCondition: "trace_annotations['quality'].score < 0.5",
      },
      {
        filterName: "equals",
        filterCondition: "trace_annotations['quality'].score == 0.5",
      },
    ]);
  });

  it("builds trace annotation label filters", () => {
    expect(
      getAnnotationTooltipFilters({
        accessor: "trace_annotations",
        name: "quality",
        label: "pass",
      })
    ).toEqual([
      {
        filterName: "match",
        filterCondition: "trace_annotations['quality'].label == \"pass\"",
      },
      {
        filterName: "exclude",
        filterCondition:
          "(trace_annotations['quality'].label != \"pass\" or trace_annotations['quality'].label is None)",
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
