export const PLAYGROUND_PROMPT_TOOL_NAMES = {
  read: "read_prompt",
  edit: "edit_prompt",
  cloneInstance: "clone_prompt_instance",
} as const;

export const READ_PROMPT_TOOL_NAME = PLAYGROUND_PROMPT_TOOL_NAMES.read;
export const EDIT_PROMPT_TOOL_NAME = PLAYGROUND_PROMPT_TOOL_NAMES.edit;
export const CLONE_PROMPT_INSTANCE_TOOL_NAME =
  PLAYGROUND_PROMPT_TOOL_NAMES.cloneInstance;
