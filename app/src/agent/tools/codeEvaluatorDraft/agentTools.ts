import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";

import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import {
  parseEditCodeEvaluatorDraftInput,
  parseReadCodeEvaluatorDraftInput,
  parseTestCodeEvaluatorDraftInput,
} from "./parsers";
import type {
  EditCodeEvaluatorDraftActionContext,
  EditCodeEvaluatorDraftInput,
  OpenCodeEvaluatorFormInput,
  ReadCodeEvaluatorDraftInput,
  SubmitCodeEvaluatorDraftInput,
  TestCodeEvaluatorDraftInput,
} from "./types";

/** Opens the code-evaluator form in the mounted dataset-backed playground. */
export const openCodeEvaluatorFormAgentTool =
  defineClientActionTool<OpenCodeEvaluatorFormInput>({
    name: OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
    parseInput: parseEmptyToolInput,
    invalidInputErrorText: `Invalid ${OPEN_CODE_EVALUATOR_FORM_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot open the evaluator form.",
    defaultSuccessOutput: "Code-evaluator form opened.",
  });

/** Reads the current code-evaluator draft from the mounted form. */
export const readCodeEvaluatorDraftAgentTool =
  defineClientActionTool<ReadCodeEvaluatorDraftInput>({
    name: READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseReadCodeEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${READ_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The code-evaluator form is not mounted; cannot read the draft.",
    defaultSuccessOutput: "Code-evaluator draft read.",
  });

/**
 * Proposes edits to the mounted code-evaluator draft as a pending change the
 * user accepts or rejects; requires an active session to attribute the edit,
 * and defers success output to that flow.
 */
export const editCodeEvaluatorDraftAgentTool = defineClientActionTool<
  EditCodeEvaluatorDraftInput,
  EditCodeEvaluatorDraftActionContext
>({
  name: EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  parseInput: parseEditCodeEvaluatorDraftInput,
  invalidInputErrorText: `Invalid ${EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected { operations: EditCodeEvaluatorDraftOperation[] }.`,
  notMountedErrorText:
    "The code-evaluator form is not mounted; cannot edit the draft.",
  requireSession: true,
  noSessionErrorText:
    "Cannot propose code-evaluator draft edits without an active session.",
  buildContext: ({ toolCall, sessionId, addToolOutput }) => ({
    toolCallId: toolCall.toolCallId,
    sessionId,
    addToolOutput,
  }),
  emitSuccess: false,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
});

/** Runs the mounted code-evaluator draft against its form payload or named overrides. */
export const testCodeEvaluatorDraftAgentTool =
  defineClientActionTool<TestCodeEvaluatorDraftInput>({
    name: TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseTestCodeEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {} or { cases: [{ id, testPayload }] }.`,
    notMountedErrorText:
      "The code-evaluator test section is not mounted; cannot test the draft.",
    defaultSuccessOutput: "Code-evaluator draft tested.",
  });

/** Persists the mounted code-evaluator draft. */
export const submitCodeEvaluatorDraftAgentTool =
  defineClientActionTool<SubmitCodeEvaluatorDraftInput>({
    name: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseEmptyToolInput,
    invalidInputErrorText: `Invalid ${SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The code-evaluator form is not mounted; cannot submit the draft.",
    defaultSuccessOutput: "Code-evaluator draft submitted.",
  });
