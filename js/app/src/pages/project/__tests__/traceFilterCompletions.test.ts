import { describe, expect, it } from "vitest";

import {
  buildTraceFilterCompletionModel,
  getTraceFilterContextualCompletions,
  type TraceFilterVocabularyTerm,
} from "../TraceFilterConditionField";

const vocabulary: TraceFilterVocabularyTerm[] = [
  {
    name: "spans",
    type: "iterable",
    description: "Every span in the trace.",
    category: "iterable",
  },
  {
    name: "span_annotations",
    type: "iterable",
    description: "Every annotation on a span.",
    category: "iterable",
  },
  {
    name: "span_cost_details",
    type: "iterable",
    description: "Every span cost detail.",
    category: "iterable",
  },
  ...["children", "siblings", "annotations", "cost_details"].map((name) => ({
    name,
    type: "iterable",
    description: `${name} nested collection.`,
    category: "element",
    iterableName: "spans",
  })),
  {
    name: "status_code",
    type: "string",
    description: "Span status.",
    category: "element",
    iterableName: "spans",
  },
  {
    name: "score",
    type: "number",
    description: "Annotation score.",
    category: "element",
    iterableName: "span_annotations",
  },
];

const completionModel = buildTraceFilterCompletionModel(vocabulary);

function getLabels({
  textBeforeCursor,
  textAfterCursor,
}: {
  textBeforeCursor: string;
  textAfterCursor: string;
}) {
  return getTraceFilterContextualCompletions({
    request: {
      isBrowsing: true,
      textBeforeCursor,
      textAfterCursor,
    },
    completionModel,
  })?.map((completion) => completion.label);
}

describe("trace filter contextual completions", () => {
  it("offers nested collections only in a nested for-clause target", () => {
    expect(
      getLabels({
        textBeforeCursor: "any(any(child. for child in ",
        textAfterCursor: ") for span in spans)",
      })
    ).toEqual([
      "span.children",
      "span.siblings",
      "span.annotations",
      "span.cost_details",
    ]);

    expect(
      getLabels({
        textBeforeCursor: "any(span.",
        textAfterCursor: " for span in spans)",
      })
    ).toEqual(["span.status_code"]);
  });
});
