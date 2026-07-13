import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";
import { parseEmptyToolInput } from "@phoenix/agent/tools/emptyToolInput";

import {
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "./constants";
import {
  parseEditLlmEvaluatorDraftInput,
  parseReadLlmEvaluatorDraftInput,
  parseTestLlmEvaluatorDraftInput,
} from "./parsers";
import type {
  EditLlmEvaluatorDraftActionContext,
  EditLlmEvaluatorDraftInput,
  OpenLlmEvaluatorFormInput,
  ReadLlmEvaluatorDraftInput,
  SubmitLlmEvaluatorDraftInput,
  TestLlmEvaluatorDraftInput,
} from "./types";

/** Opens the LLM-evaluator form in the mounted dataset-backed playground. */
export const openLlmEvaluatorFormAgentTool =
  defineClientActionTool<OpenLlmEvaluatorFormInput>({
    name: OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
    parseInput: parseEmptyToolInput,
    invalidInputErrorText: `Invalid ${OPEN_LLM_EVALUATOR_FORM_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot open the evaluator form.",
    defaultSuccessOutput: "LLM-evaluator form opened.",
  });

/** Reads the current LLM-evaluator draft from the mounted form. */
export const readLlmEvaluatorDraftAgentTool =
  defineClientActionTool<ReadLlmEvaluatorDraftInput>({
    name: READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseReadLlmEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${READ_LLM_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The LLM-evaluator form is not mounted; cannot read the draft.",
    defaultSuccessOutput: "LLM-evaluator draft read.",
  });

/**
 * Proposes edits to the mounted LLM-evaluator draft as a pending change the
 * user accepts or rejects; requires an active session to attribute the edit,
 * and defers success output to that flow.
 */
export const editLlmEvaluatorDraftAgentTool = defineClientActionTool<
  EditLlmEvaluatorDraftInput,
  EditLlmEvaluatorDraftActionContext
>({
  name: EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  parseInput: parseEditLlmEvaluatorDraftInput,
  invalidInputErrorText: `Invalid ${EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME} input. Expected { operations: EditLlmEvaluatorDraftOperation[] }.`,
  notMountedErrorText:
    "The LLM-evaluator form is not mounted; cannot edit the draft.",
  requireSession: true,
  noSessionErrorText:
    "Cannot propose LLM-evaluator draft edits without an active session.",
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

/** Runs the mounted LLM-evaluator draft against its form payload or named overrides. */
export const testLlmEvaluatorDraftAgentTool =
  defineClientActionTool<TestLlmEvaluatorDraftInput>({
    name: TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseTestLlmEvaluatorDraftInput,
    invalidInputErrorText: `Invalid ${TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {} or { cases: [{ id, testPayload }] }.`,
    notMountedErrorText:
      "The LLM-evaluator form is not mounted; cannot test the draft.",
    defaultSuccessOutput: "LLM-evaluator draft tested.",
  });

/** Persists the mounted LLM-evaluator draft. */
export const submitLlmEvaluatorDraftAgentTool =
  defineClientActionTool<SubmitLlmEvaluatorDraftInput>({
    name: SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
    parseInput: parseEmptyToolInput,
    invalidInputErrorText: `Invalid ${SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The LLM-evaluator form is not mounted; cannot submit the draft.",
    defaultSuccessOutput: "LLM-evaluator draft submitted.",
  });
