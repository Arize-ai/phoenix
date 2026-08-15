import { EditorState } from "@codemirror/state";
import { EditorView } from "@uiw/react-codemirror";
import { describe, expect, it } from "vitest";

import {
  buildTraceFilterCompletionModel,
  getTraceFilterContextualCompletions,
  type TraceFilterVocabularyTerm,
} from "../TraceFilterConditionField";

const vocabulary: TraceFilterVocabularyTerm[] = [
  {
    name: "attributes[...]",
    type: "string",
    description: "Displayed-root attribute by key.",
    category: "attribute",
  },
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

function applyCompletion(
  completion: (typeof completionModel.completions)[number]
) {
  const view = new EditorView({ state: EditorState.create() });
  const apply = completion.apply ?? completion.label;
  if (typeof apply === "string") {
    view.dispatch({ changes: { from: 0, insert: apply } });
  } else {
    apply(view, completion, 0, 0);
  }
  const result = view.state.doc.toString();
  view.destroy();
  return result;
}

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
  it("inserts an editable key for generic attributes", () => {
    const completion = completionModel.completions.find(
      ({ label }) => label === "attributes[...]"
    );
    expect(completion).toBeDefined();
    expect(applyCompletion(completion!)).toBe('attributes["key"]');
  });

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
