// Must byte-match the server tool NAMEs (create_annotation_config.py /
// update_annotation_config.py) — the name is the single contract between server
// advertisement and browser dispatch.
export const CREATE_ANNOTATION_CONFIG_TOOL_NAME = "create_annotation_config";
export const UPDATE_ANNOTATION_CONFIG_TOOL_NAME = "update_annotation_config";

export const ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE =
  "You rejected the proposed annotation config change, so nothing was written.";
