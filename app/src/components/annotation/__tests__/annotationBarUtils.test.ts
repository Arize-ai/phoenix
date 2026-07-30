import { describe, expect, it } from "vitest";

import {
  getAnnotationAggregate,
  getInferredAnnotationConfigDraft,
  groupAnnotationsByName,
} from "@phoenix/components/annotation/annotationBarUtils";

describe("getAnnotationAggregate", () => {
  it("keeps a single annotation literal", () => {
    expect(
      getAnnotationAggregate({
        annotations: [{ name: "quality", label: "good", score: 0.8 }],
      })
    ).toEqual({ label: "good", score: 0.8, isMixed: false });
  });

  it("averages numeric annotations", () => {
    expect(
      getAnnotationAggregate({
        annotations: [
          { name: "quality", score: 0.2 },
          { name: "quality", score: 0.8 },
        ],
      })
    ).toEqual({ label: null, score: 0.5, isMixed: false });
  });

  it("joins label-only annotations", () => {
    expect(
      getAnnotationAggregate({
        annotations: [
          { name: "quality", label: "good" },
          { name: "quality", label: "great" },
        ],
      })
    ).toEqual({ label: "good, great", score: null, isMixed: false });
  });

  it("marks combined multi-annotation values as mixed", () => {
    expect(
      getAnnotationAggregate({
        annotations: [
          { name: "quality", label: "good", score: 0.4 },
          { name: "quality", label: "great", score: 0.8 },
        ],
      })
    ).toEqual({ label: "mixed", score: 0.6000000000000001, isMixed: true });
  });
});

describe("groupAnnotationsByName", () => {
  it("groups configured annotations and omits notes", () => {
    expect(
      groupAnnotationsByName({
        annotations: [
          { id: "1", name: "quality", score: 1 },
          { id: "2", name: "note", explanation: "private note" },
          { id: "3", name: "quality", score: 0 },
        ],
      })
    ).toEqual({
      quality: [
        { id: "1", name: "quality", score: 1 },
        { id: "3", name: "quality", score: 0 },
      ],
    });
  });
});

describe("getInferredAnnotationConfigDraft", () => {
  it("infers continuous bounds from scores", () => {
    expect(
      getInferredAnnotationConfigDraft({
        name: "tool_count_per_turn",
        annotations: [{ name: "tool_count_per_turn", score: 3 }],
      })
    ).toMatchObject({
      annotationType: "CONTINUOUS",
      lowerBound: 0,
      name: "tool_count_per_turn",
      optimizationDirection: "NONE",
      upperBound: 3,
    });
  });

  it("infers categorical values from labels", () => {
    expect(
      getInferredAnnotationConfigDraft({
        name: "quality",
        annotations: [
          { name: "quality", label: "good", score: 1 },
          { name: "quality", label: "bad", score: 0 },
        ],
      })
    ).toMatchObject({
      annotationType: "CATEGORICAL",
      optimizationDirection: "NONE",
      values: [
        { label: "good", score: 1 },
        { label: "bad", score: 0 },
      ],
    });
  });

  it("infers freeform when no label or score is present", () => {
    expect(
      getInferredAnnotationConfigDraft({
        name: "note",
        annotations: [{ name: "note", explanation: "Needs review" }],
      })
    ).toMatchObject({
      annotationType: "FREEFORM",
      optimizationDirection: "NONE",
    });
  });
});
