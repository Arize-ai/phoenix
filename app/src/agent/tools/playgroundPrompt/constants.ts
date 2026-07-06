export const PLAYGROUND_PROMPT_TOOL_NAMES = {
  read: "read_prompt_instance",
  edit: "edit_prompt_instance",
  cloneInstance: "clone_prompt_instance",
  addInstance: "add_prompt_instance",
  removeInstance: "remove_prompt_instance",
} as const;

export const READ_PROMPT_TOOL_NAME = PLAYGROUND_PROMPT_TOOL_NAMES.read;
export const EDIT_PROMPT_TOOL_NAME = PLAYGROUND_PROMPT_TOOL_NAMES.edit;
export const CLONE_PROMPT_INSTANCE_TOOL_NAME =
  PLAYGROUND_PROMPT_TOOL_NAMES.cloneInstance;
export const ADD_PROMPT_INSTANCE_TOOL_NAME =
  PLAYGROUND_PROMPT_TOOL_NAMES.addInstance;
export const REMOVE_PROMPT_INSTANCE_TOOL_NAME =
  PLAYGROUND_PROMPT_TOOL_NAMES.removeInstance;

export const EDIT_PROMPT_NAVIGATION_CANCEL_ERROR =
  "The playground was closed before this edit could be reviewed, so it was discarded.";
export const REMOVE_PROMPT_INSTANCE_NAVIGATION_CANCEL_ERROR =
  "The playground was closed before this prompt instance removal could be reviewed, so it was discarded.";
