import {
  EditorState,
  type EditorView,
  type Transaction,
} from "@uiw/react-codemirror";
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

/**
 * Expands a snippet completion against state alone. The applier only reads
 * `state` and dispatches the transaction it builds, so the snippet expands for
 * real — a live `EditorView` would instead measure a viewport against a layout
 * jsdom does not compute. `EditorState` must come from the same re-export the
 * editor uses: state resolved from a second copy of `@codemirror/state` fails
 * the `instanceof` check inside `update`, which drops the placeholder
 * selection rather than erroring.
 */
function applySnippetCompletion(
  completion: (typeof completionModel.completions)[number]
) {
  const applySnippet = completion.apply;
  if (typeof applySnippet !== "function") {
    throw new Error(`"${completion.label}" does not apply a snippet`);
  }
  let state = EditorState.create();
  applySnippet(
    {
      get state() {
        return state;
      },
      dispatch: (transaction: Transaction) => {
        state = transaction.state;
      },
    } as unknown as EditorView,
    completion,
    0,
    0
  );
  const { from, to } = state.selection.main;
  return {
    text: state.doc.toString(),
    selectedText: state.doc.sliceString(from, to),
  };
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

    const { text, selectedText } = applySnippetCompletion(completion!);

    expect(text).toBe('attributes["key"]');
    expect(selectedText).toBe("key");
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
