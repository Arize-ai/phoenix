export const CODE_EVALUATOR_DRAFT_TOOL_NAMES = {
  read: "read_code_evaluator_draft",
  edit: "edit_code_evaluator_draft",
  test: "test_code_evaluator_draft",
} as const;

export const READ_CODE_EVALUATOR_DRAFT_TOOL_NAME =
  CODE_EVALUATOR_DRAFT_TOOL_NAMES.read;
export const EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME =
  CODE_EVALUATOR_DRAFT_TOOL_NAMES.edit;
export const TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME =
  CODE_EVALUATOR_DRAFT_TOOL_NAMES.test;

export const OPEN_CODE_EVALUATOR_FORM_TOOL_NAME = "open_code_evaluator_form";

export const EDIT_CODE_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR =
  "The code-evaluator form was closed before this edit could be reviewed, so it was discarded.";
