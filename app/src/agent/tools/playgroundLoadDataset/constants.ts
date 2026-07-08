// Must byte-match the server tool NAME (load_dataset.py) — the name is the
// single contract between server advertisement and browser dispatch.
export const LOAD_DATASET_TOOL_NAME = "load_dataset";

export const LOAD_DATASET_NAVIGATION_CANCEL_ERROR =
  "The playground was closed before this dataset load could be reviewed, so it was discarded.";
