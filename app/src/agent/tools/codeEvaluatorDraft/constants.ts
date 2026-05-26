export const CODE_EVALUATOR_DRAFT_TOOL_NAMES = {
  read: "read_code_evaluator_draft",
  edit: "edit_code_evaluator_draft",
} as const;

export const READ_CODE_EVALUATOR_DRAFT_TOOL_NAME =
  CODE_EVALUATOR_DRAFT_TOOL_NAMES.read;
export const EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME =
  CODE_EVALUATOR_DRAFT_TOOL_NAMES.edit;

export const EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR =
  "The code-evaluator form was closed before this edit could be reviewed, so it was discarded.";

export const CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR =
  "The session was closed before this code-evaluator create proposal could be reviewed, so it was discarded.";
