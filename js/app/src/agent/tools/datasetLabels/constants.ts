// Must byte-match the server tool NAMEs — the name is the single contract
// between server advertisement and browser dispatch.
// `list_dataset_labels` lists the labels ON the in-view dataset (Dataset.labels);
// `list_labels` lists the instance-wide label vocabulary (Query.datasetLabels).
export const LIST_DATASET_LABELS_TOOL_NAME = "list_dataset_labels";
export const LIST_LABELS_TOOL_NAME = "list_labels";
export const CREATE_DATASET_LABEL_TOOL_NAME = "create_dataset_label";
export const SET_DATASET_LABELS_TOOL_NAME = "set_dataset_labels";
export const DELETE_DATASET_LABELS_TOOL_NAME = "delete_dataset_labels";

export const DATASET_LABELS_NO_DATASET_ERROR =
  "No dataset is in view. Open a dataset first.";

export const LIST_LABELS_DEFAULT_LIMIT = 20;
export const LIST_LABELS_MAX_LIMIT = 50;

/** Matches the dataset-split form's default color, reused for labels. */
export const DEFAULT_DATASET_LABEL_COLOR = "#33c5e8";
