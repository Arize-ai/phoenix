// Must byte-match the server tool NAME (add_dataset_examples.py) — the name is
// the single contract between server advertisement and browser dispatch.
export const ADD_DATASET_EXAMPLES_TOOL_NAME = "add_dataset_examples";

export const ADD_DATASET_EXAMPLES_NO_DATASET_ERROR =
  "No dataset is in view, so there is nothing to add examples to. Open a dataset first.";

// Must byte-match the server tool NAME (list_dataset_examples.py).
export const LIST_DATASET_EXAMPLES_TOOL_NAME = "list_dataset_examples";

export const LIST_DATASET_EXAMPLES_NO_DATASET_ERROR =
  "No dataset is in view, so there are no examples to list. Open a dataset first.";

export const LIST_DATASET_EXAMPLES_DEFAULT_LIMIT = 10;
export const LIST_DATASET_EXAMPLES_MAX_LIMIT = 50;

// Must byte-match the server tool NAMEs (patch/delete_dataset_examples.py).
export const PATCH_DATASET_EXAMPLES_TOOL_NAME = "patch_dataset_examples";
export const DELETE_DATASET_EXAMPLES_TOOL_NAME = "delete_dataset_examples";
