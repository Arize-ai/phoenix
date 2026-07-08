// Must byte-match the server tool NAMEs — the name is the single contract
// between server advertisement and browser dispatch.
// `list_dataset_splits` lists the splits ON the in-view dataset (Dataset.splits);
// `list_splits` lists the instance-wide split vocabulary (Query.datasetSplits).
export const LIST_DATASET_SPLITS_TOOL_NAME = "list_dataset_splits";
export const LIST_SPLITS_TOOL_NAME = "list_splits";
export const CREATE_DATASET_SPLIT_TOOL_NAME = "create_dataset_split";
export const SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME =
  "set_dataset_example_splits";
export const PATCH_DATASET_SPLIT_TOOL_NAME = "patch_dataset_split";
export const DELETE_DATASET_SPLITS_TOOL_NAME = "delete_dataset_splits";

export const DATASET_SPLITS_NO_DATASET_ERROR =
  "No dataset is in view, so there are no splits to read. Open a dataset first.";

export const LIST_SPLITS_DEFAULT_LIMIT = 20;
export const LIST_SPLITS_MAX_LIMIT = 50;

/** Matches the dataset-split form's default color (NewDatasetSplitForm). */
export const DEFAULT_DATASET_SPLIT_COLOR = "#33c5e8";
