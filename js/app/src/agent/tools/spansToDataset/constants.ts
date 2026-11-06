// Must byte-match the server tool NAME (add_spans_to_dataset.py) — the name is
// the single contract between server advertisement and browser dispatch.
export const ADD_SPANS_TO_DATASET_TOOL_NAME = "add_spans_to_dataset";

export const ADD_SPANS_TO_DATASET_NO_SPAN_ERROR =
  "No span is in view and no spanIds were given, so there is nothing to add. Open a span first.";
