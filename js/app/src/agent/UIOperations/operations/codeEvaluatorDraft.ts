import { z } from "zod";

import { editCodeEvaluatorDraftInputSchema } from "@phoenix/agent/tools/codeEvaluatorDraft";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";

/**
 * Route hint for the draft operations: they only dispatch while a
 * code-evaluator form dialog is open.
 */
const CODE_EVALUATOR_DRAFT_ROUTE_HINT =
  "an open evaluator form dialog — call evaluators.code.openForm, " +
  "evaluators.llm.openForm, or evaluators.openForEdit first";

/**
 * No-argument input, mirroring the Python schema's
 * `{"type": "object", "properties": {}, "additionalProperties": false}`.
 */
const emptyInputSchema = z.strictObject({});

/**
 * The catalog entry replacing the `open_code_evaluator_form` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`.
 */
export const openCodeEvaluatorFormOperation = defineUIOperation({
  name: "evaluators.code.openForm",
  description:
    "Open the dataset-backed code-evaluator form from the current playground " +
    "without navigating away. Use this when a dataset is mounted in the playground " +
    "and the user wants to author a code evaluator. This opens the existing " +
    "create-code-evaluator form; it does not persist or create an evaluator.",
  inputSchema: emptyInputSchema,
  kind: "write",
  defaultSuccessOutput: "Code evaluator form opened.",
  availability: {
    // The handler registers only while the playground has a dataset loaded
    // (Playground.tsx guards registration on `datasetId`), so the hint must
    // name that precondition — a route-only hint reads as a lie to an agent
    // that is already on /playground.
    routeHint:
      "the Prompt Playground page with a dataset loaded " +
      "(load one with playground.dataset.load)",
  },
});

/**
 * The catalog entry replacing the `read_code_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`,
 * with tool references rewritten to operation names.
 */
export const readCodeEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.code.read",
  description:
    "Read the open code-evaluator draft. Returns the draft's name, description, " +
    "language, sourceCode, sandboxConfigId, inputMapping, outputConfigs, " +
    "testPayload, form mode (`create` or `edit`), and `availableSandboxConfigs` " +
    "(id, name, language, backendType) — pick the `sandboxConfigId` for " +
    "`set_sandbox_config` from that list instead of querying the API. " +
    "Call this before `evaluators.code.edit` or " +
    "`evaluators.code.test` to see the current draft.",
  inputSchema: emptyInputSchema,
  kind: "read",
  defaultSuccessOutput: "Code evaluator draft read.",
  availability: {
    routeHint: CODE_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `edit_code_evaluator_draft` client-action
 * tool. The input schema is reused from the existing tool module
 * (`@phoenix/agent/tools/codeEvaluatorDraft`); the description moves here
 * verbatim from the Python `DESCRIPTION`, with tool references rewritten to
 * operation names. Approval: the browser stages an inline diff and the
 * promise resolves only after the user accepts or rejects it.
 */
export const editCodeEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.code.edit",
  description:
    "Propose edits to the open code-evaluator draft. This operation does not change " +
    "the form immediately: the browser renders an inline diff and the user must " +
    "accept or reject it. Call `evaluators.code.read` first to see the " +
    "current draft before proposing edits. " +
    "Use camelCase field names exactly as shown. Common valid examples: " +
    '{"type":"set_source_code","sourceCode":"def evaluate(output):\\n    return 1.0"}; ' +
    '{"type":"set_language","language":"PYTHON"}; ' +
    '{"type":"set_sandbox_config","sandboxConfigId":"U2FuZGJveENvbmZpZzox"}; ' +
    '{"type":"set_input_mapping","inputMapping":{"pathMapping":{},"literalMapping":{}}}; ' +
    '{"type":"set_test_payload","testPayload":{"input":{},' +
    '"output":{"messages":[{"role":"assistant","content":"ok"}]},' +
    '"reference":{},"metadata":{}}}. ' +
    "Do not emit `set_sandbox_config` when the read draft already has a compatible " +
    "sandbox and the user did not ask to change it.",
  inputSchema: editCodeEvaluatorDraftInputSchema,
  kind: "approval",
  requireSession: true,
  UIBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Code evaluator draft edits accepted.",
  availability: {
    routeHint: CODE_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `test_code_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`
 * (which lives in `run_code_evaluator_draft.py`; the module uses `run` so
 * pytest does not collect it as a test).
 */
export const testCodeEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.code.test",
  description:
    "Run the open code-evaluator draft against its current test payload through " +
    "the form preview path. This previews the draft only and does " +
    "not persist, create, or update an evaluator.",
  inputSchema: emptyInputSchema,
  kind: "write",
  defaultSuccessOutput: "Code evaluator draft test run completed.",
  availability: {
    routeHint: CODE_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `submit_code_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`.
 */
export const submitCodeEvaluatorDraftOperation = defineUIOperation({
  name: "evaluators.code.submit",
  description:
    "Persist the open code-evaluator draft through the form's validated save path — " +
    "the same create/patch the Create/Update button runs. Terminal save only; it does " +
    "not modify the draft.",
  inputSchema: emptyInputSchema,
  kind: "write",
  defaultSuccessOutput: "Code evaluator draft saved.",
  availability: {
    routeHint: CODE_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * All code-evaluator draft catalog entries, in lifecycle order: open the
 * form, read the draft, propose edits, test-run, and submit.
 */
export const codeEvaluatorDraftOperations: UIOperationDescriptor[] = [
  openCodeEvaluatorFormOperation,
  readCodeEvaluatorDraftOperation,
  editCodeEvaluatorDraftOperation,
  testCodeEvaluatorDraftOperation,
  submitCodeEvaluatorDraftOperation,
];
