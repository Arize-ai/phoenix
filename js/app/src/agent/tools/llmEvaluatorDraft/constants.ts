export const LLM_EVALUATOR_DRAFT_TOOL_NAMES = {
  read: "read_llm_evaluator_draft",
  edit: "edit_llm_evaluator_draft",
  test: "test_llm_evaluator_draft",
  submit: "submit_llm_evaluator_draft",
} as const;

export const READ_LLM_EVALUATOR_DRAFT_TOOL_NAME =
  LLM_EVALUATOR_DRAFT_TOOL_NAMES.read;
export const EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME =
  LLM_EVALUATOR_DRAFT_TOOL_NAMES.edit;
export const TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME =
  LLM_EVALUATOR_DRAFT_TOOL_NAMES.test;
export const SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME =
  LLM_EVALUATOR_DRAFT_TOOL_NAMES.submit;

export const OPEN_LLM_EVALUATOR_FORM_TOOL_NAME = "open_llm_evaluator_form";

export const EDIT_LLM_EVALUATOR_DRAFT_NAVIGATION_CANCEL_ERROR =
  "The LLM-evaluator form was closed before this edit could be reviewed, so it was discarded.";
