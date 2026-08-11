import { z } from "zod";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Route hint for the draft operations: they only dispatch while an
 * LLM-evaluator form dialog is open.
 */
const LLM_EVALUATOR_DRAFT_ROUTE_HINT =
  "an open evaluator form dialog — call evaluators.code.openForm, " +
  "evaluators.llm.openForm, or evaluators.openForEdit first";

/**
 * No-argument input, mirroring the Python schema's
 * `{"type": "object", "properties": {}, "additionalProperties": false}`.
 */
const emptyInputSchema = z.strictObject({});

/**
 * JSON object with arbitrary JSON-safe values — the Python
 * `JSON_RECORD_SCHEMA` (`additionalProperties: true`).
 */
const jsonRecordSchema = z
  .record(z.string(), z.unknown())
  .describe("JSON object with arbitrary JSON-safe values.");

/**
 * The Python `TEST_PAYLOAD_SCHEMA`: all four mapping-source sections are
 * required, unknown keys rejected.
 */
const testPayloadSchema = z.strictObject({
  input: jsonRecordSchema,
  output: jsonRecordSchema,
  reference: jsonRecordSchema,
  metadata: jsonRecordSchema,
});

/**
 * The Python `OUTPUT_CONFIG_DRAFT_SCHEMA` for the LLM-evaluator form, which
 * exercises only the classification output variant.
 */
const classificationOutputConfigSchema = z
  .strictObject({
    kind: z.enum(["classification"]),
    name: z.string(),
    optimizationDirection: z.enum(["MINIMIZE", "MAXIMIZE", "NONE"]),
    values: z.array(
      z.strictObject({
        label: z.string(),
        score: z.number().nullable().optional(),
      })
    ),
  })
  .describe(
    "One classification output config the judge produces. `values` is the " +
      "list of labels (each optionally scored) the annotation can take."
  );

/** The Python `JUDGE_MESSAGE_SCHEMA`. */
const judgeMessageSchema = z
  .strictObject({
    role: z
      .enum(["user", "ai", "system", "tool"])
      .describe(
        "Message role. Roles are user/ai/system/tool; the OpenAI-style " +
          "`assistant` is accepted as an alias for `ai`. Prefer emitting " +
          "`ai` directly."
      ),
    content: z.string(),
  })
  .describe("One judge prompt message: a role and its text content.");

/**
 * The Python `OPERATION_SCHEMA`, mirrored exactly: a single object
 * discriminated informally by `type` (the only required field), with every
 * per-type field optional — the per-type requirements are documented in the
 * object description rather than enforced structurally, matching the server
 * schema this replaces.
 */
const editLlmEvaluatorDraftOperationSchema = z
  .strictObject({
    type: z
      .enum([
        "set_judge_prompt",
        "set_judge_model",
        "set_include_explanation",
        "set_input_mapping",
        "set_description",
        "set_name",
        "set_output_configs",
        "set_test_payload",
      ])
      .describe("The operation kind."),
    messages: z
      .array(judgeMessageSchema)
      .min(1)
      .optional()
      .describe(
        "Whole-list replacement of the judge prompt messages. Each " +
          "message has a role and string content; reference the run " +
          "fields via template variables (e.g. `{{input}}`, `{{output}}`)."
      ),
    templateFormat: z
      .enum(["MUSTACHE", "F_STRING", "NONE"])
      .optional()
      .describe("Template variable syntax used in the judge prompt messages."),
    model: z
      .string()
      .optional()
      .describe(
        "Judge model name (e.g. `gpt-4o`). Must match a provider with an installed " +
          "SDK; prefer a provider whose credentials are already configured (see the " +
          "context's available model providers guidance)."
      ),
    provider: z
      .string()
      .optional()
      .describe("Judge model provider key (e.g. `OPENAI`, `ANTHROPIC`)."),
    invocationParameters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Judge model invocation parameters (e.g. temperature). Omit to " +
          "keep the draft's current parameters."
      ),
    includeExplanation: z
      .boolean()
      .optional()
      .describe(
        "Whether the judge must emit a free-text `explanation` alongside " +
          "its label. The judge prompt tool is regenerated to match when applied."
      ),
    inputMapping: z
      .strictObject({
        pathMapping: z.record(z.string(), z.string()).optional(),
        literalMapping: z.record(z.string(), z.unknown()).optional(),
      })
      .optional()
      .describe(
        "Replacement input mapping. The form treats `pathMapping` as " +
          "field-path lookups and `literalMapping` as literal values."
      ),
    description: z
      .string()
      .optional()
      .describe("Replacement evaluator description."),
    name: z
      .string()
      .optional()
      .describe("Replacement user-facing evaluator name."),
    outputConfigs: z
      .array(classificationOutputConfigSchema)
      .optional()
      .describe(
        "Whole-list replacement of the judge's classification output " +
          "configs. Each entry follows the classification OutputConfigDraft."
      ),
    testPayload: testPayloadSchema
      .optional()
      .describe(
        "Replacement mapping source used by the evaluator preview/test section. " +
          "For dataset-backed evaluators, shape `output` like a representative " +
          "future experiment run output; relational evaluators can compare it " +
          "to `reference`."
      ),
  })
  .describe(
    "One LLM-evaluator draft edit operation. Required fields by type: " +
      "set_judge_prompt requires messages and may also set templateFormat; " +
      "set_judge_model requires model and provider together and may also set " +
      "invocationParameters; set_include_explanation requires " +
      "includeExplanation; set_input_mapping requires inputMapping; " +
      "set_description requires description; set_name requires name; " +
      "set_output_configs requires outputConfigs (whole-list replace); " +
      "set_test_payload requires testPayload."
  );

/**
 * Input schema for `evaluators.llm.edit`, ported in full from the Python
 * `PARAMETERS` in
 * `src/phoenix/server/agents/capabilities/tools/external/edit_llm_evaluator_draft.py`.
 */
const editLlmEvaluatorDraftInputSchema = z.strictObject({
  operations: z
    .array(editLlmEvaluatorDraftOperationSchema)
    .min(1)
    .describe("Ordered edit operations to propose for the draft."),
});

/** Input for `evaluators.llm.edit`. */
export type EditLlmEvaluatorDraftOperationInput = z.infer<
  typeof editLlmEvaluatorDraftInputSchema
>;

/**
 * The catalog entry replacing the `open_llm_evaluator_form` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`.
 */
export const openLlmEvaluatorFormOperation = defineUiOperation({
  name: "evaluators.llm.openForm",
  description:
    "Open the dataset-backed LLM-evaluator form from the current playground " +
    "without navigating away. Use this when a dataset is mounted in the playground " +
    "and the user wants to author an LLM-as-a-judge evaluator. This opens the existing " +
    "create-LLM-evaluator form; it does not persist or create an evaluator.",
  inputSchema: emptyInputSchema,
  kind: "write",
  defaultSuccessOutput: "LLM evaluator form opened.",
  availability: {
    routeHint: "the Prompt Playground page (a /playground route)",
  },
});

/**
 * The catalog entry replacing the `read_llm_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`,
 * with tool references rewritten to operation names.
 */
export const readLlmEvaluatorDraftOperation = defineUiOperation({
  name: "evaluators.llm.read",
  description:
    "Read the open LLM-evaluator draft. Returns the draft's name, description, " +
    "judge prompt messages, model, provider, invocationParameters, outputConfigs, " +
    "inputMapping, includeExplanation, testPayload, and form mode " +
    "(`create` or `edit`). Call this before `evaluators.llm.edit` or " +
    "`evaluators.llm.test` to see the current draft.",
  inputSchema: emptyInputSchema,
  kind: "read",
  defaultSuccessOutput: "LLM evaluator draft read.",
  availability: {
    routeHint: LLM_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `edit_llm_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`,
 * with tool references rewritten to operation names. Approval: the browser
 * stages an inline diff and the promise resolves only after the user accepts
 * or rejects it.
 */
export const editLlmEvaluatorDraftOperation = defineUiOperation({
  name: "evaluators.llm.edit",
  description:
    "Propose edits to the open LLM-evaluator draft. This operation does not change " +
    "the form immediately: the browser renders an inline diff and the user must " +
    "accept or reject it. Call `evaluators.llm.read` first to see the " +
    "current draft before proposing edits. " +
    "Use camelCase field names exactly as shown. Common valid examples: " +
    '{"type":"set_judge_prompt","messages":[{"role":"system","content":' +
    '"You are a strict grader."},{"role":"user","content":' +
    '"Question: {{input}}\\nAnswer: {{output}}"}]}; ' +
    '{"type":"set_judge_model","model":"gpt-4o","provider":"OPENAI"}; ' +
    '{"type":"set_include_explanation","includeExplanation":true}; ' +
    '{"type":"set_input_mapping","inputMapping":{"pathMapping":{},"literalMapping":{}}}; ' +
    '{"type":"set_test_payload","testPayload":{"input":{},' +
    '"output":{"messages":[{"role":"assistant","content":"ok"}]},' +
    '"reference":{},"metadata":{}}}. ' +
    "Do not set the judge prompt `tools` or `toolChoice`; they are derived from " +
    "`outputConfigs` and `includeExplanation` when the edit is applied.",
  inputSchema: editLlmEvaluatorDraftInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "LLM evaluator draft edits accepted.",
  availability: {
    routeHint: LLM_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `test_llm_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`
 * (which lives in `run_llm_evaluator_draft.py`; the module uses `run` so
 * pytest does not collect it as a test).
 */
export const testLlmEvaluatorDraftOperation = defineUiOperation({
  name: "evaluators.llm.test",
  description:
    "Run the open LLM-evaluator draft against its current test payload through " +
    "the form preview path. This runs the judge model and returns the preview " +
    "result; it does not persist, create, or update an evaluator.",
  inputSchema: emptyInputSchema,
  kind: "write",
  defaultSuccessOutput: "LLM evaluator draft test run completed.",
  availability: {
    routeHint: LLM_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `submit_llm_evaluator_draft` client-action
 * tool. The description moves here verbatim from the Python `DESCRIPTION`.
 */
export const submitLlmEvaluatorDraftOperation = defineUiOperation({
  name: "evaluators.llm.submit",
  description:
    "Persist the open LLM-evaluator draft through the form's validated save path — " +
    "the same create/patch the Create/Update button runs. Terminal save only; it does " +
    "not modify the draft.",
  inputSchema: emptyInputSchema,
  kind: "write",
  defaultSuccessOutput: "LLM evaluator draft saved.",
  availability: {
    routeHint: LLM_EVALUATOR_DRAFT_ROUTE_HINT,
  },
});

/**
 * All LLM-evaluator draft catalog entries, in lifecycle order: open the
 * form, read the draft, propose edits, test-run, and submit.
 */
export const llmEvaluatorDraftOperations: UiOperationDescriptor[] = [
  openLlmEvaluatorFormOperation,
  readLlmEvaluatorDraftOperation,
  editLlmEvaluatorDraftOperation,
  testLlmEvaluatorDraftOperation,
  submitLlmEvaluatorDraftOperation,
];
