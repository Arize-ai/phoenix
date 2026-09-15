import { z } from "zod";

import {
  addPromptInstanceInputSchema,
  clonePromptInstanceInputSchema,
  editPromptInputSchema,
  readPromptInputSchema,
  removePromptInstanceInputSchema,
} from "@phoenix/agent/tools/playgroundPrompt/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";
import {
  PLAYGROUND_PROMPT_ROUTE_HINT,
  PLAYGROUND_ROUTE_HINT,
} from "./playgroundRouteHints";

/**
 * Documentation-only mirror of {@link PromptSnapshot} — what
 * `playground.prompt.read` resolves with. Kept approximate on purpose (see
 * `outputSchema` on the descriptor type): the top-level field names are what
 * scripts branch on.
 */
export const promptSnapshotOutputSchema = z.object({
  instanceId: z.number(),
  index: z.number(),
  label: z.string(),
  revision: z.string(),
  dirty: z.boolean(),
  prompt: z
    .object({
      id: z.string().optional(),
      version: z.string().optional(),
      tag: z.string().nullable().optional(),
    })
    .nullable(),
  messages: z.array(
    z.object({
      id: z.number(),
      role: z.string(),
      content: z.string().optional(),
      toolCallId: z.string().optional(),
      toolCalls: z.unknown().optional(),
    })
  ),
});

/**
 * The catalog entry replacing the `read_prompt_instance` client-action tool.
 * The input schema is reused from the existing tool module; the description
 * moves here verbatim from the Python `DESCRIPTION` with tool names updated
 * to operation names.
 */
export const readPromptOperation = defineUIOperation({
  name: "playground.prompt.read",
  description:
    "Read the current playground prompt for one instance. Use this before editing a " +
    "playground prompt so you have stable message IDs and the latest revision token. " +
    "The result includes both the numeric `instanceId` for tool calls and the alphabetic " +
    "`label` (A, B, C, D) shown to the user; use labels when discussing instances with " +
    "the user. " +
    "If there is exactly one playground instance, `instanceId` may be omitted. If " +
    "there are multiple comparison instances, pass the specific `instanceId`. " +
    "On an evaluator page the instance's prompt is the LLM evaluator's judge " +
    "prompt; the rest of an evaluator task is read with `playground.evaluator.read`.",
  inputSchema: readPromptInputSchema,
  outputSchema: promptSnapshotOutputSchema,
  operationKind: "read",
  defaultSuccessOutput: "Prompt instance read.",
  availability: {
    routeHint: PLAYGROUND_PROMPT_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `clone_prompt_instance` client-action tool.
 */
export const clonePromptInstanceOperation = defineUIOperation({
  name: "playground.instance.clone",
  description:
    "Clone an existing playground instance — a prompt task or an evaluator task — " +
    "into a new comparison instance. Use this before proposing edits when the user " +
    "wants to compare a variant against the original. If there is exactly one " +
    "playground instance, `instanceId` may be omitted. If there are multiple " +
    "comparison instances, pass the specific `instanceId` to clone. Use the " +
    "alphabetic labels (A, B, C, D) when discussing instances with the user, but " +
    "pass numeric instance IDs when calling tools. The playground supports at most " +
    "4 comparison instances; this tool is rejected when 4 instances already exist. " +
    "The cloned instance receives fresh message IDs; call `playground.prompt.read` " +
    "(or `playground.evaluator.read` for an evaluator task) on the clone before " +
    "editing it.",
  inputSchema: clonePromptInstanceInputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Prompt instance cloned.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry for Compare: a comparison instance built from a task
 * source, of the kind the page already holds.
 */
export const addPromptInstanceOperation = defineUIOperation({
  name: "playground.instance.add",
  description:
    "Add a comparison instance to the mounted playground (at most 4; rejected while " +
    "a run is active). `source` defaults to a new task of the page's kind: " +
    '{type:"new",kind:"prompt"} on a prompt page, {type:"new",kind:"LLM"} on an ' +
    'evaluator page. Other sources: {type:"new",kind:"CODE"}; a saved prompt ' +
    '{type:"prompt",promptId,promptVersionId?,tagName?}; a saved evaluator ' +
    '{type:"evaluator",evaluatorId} or {type:"datasetEvaluator",datasetEvaluatorId}; ' +
    'or {type:"duplicate"} for a copy of the first instance. The page holds one kind ' +
    "of task, so a source of the other kind is rejected: to switch kinds, call " +
    "`playground.task.select` on a page with a single instance. A new task inherits " +
    "the first instance's model and has no saved association. Awaits a saved " +
    'source\'s load and returns {status:"added", addedInstance, message}, where ' +
    "`addedInstance` is the `playground.prompt.read` snapshot for a prompt task or " +
    "the `playground.evaluator.read` snapshot for an evaluator task — with the new " +
    "numeric `instanceId` and the `revision` needed to edit it.",
  inputSchema: addPromptInstanceInputSchema,
  operationKind: "write",
  // Awaits the fetch of a saved prompt or evaluator.
  longRunning: true,
  defaultSuccessOutput: "Instance added.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `remove_prompt_instance` client-action
 * tool. Removal is an approval operation: the handler stages a pending
 * removal that resolves only after the user accepts or rejects it.
 */
export const removePromptInstanceOperation = defineUIOperation({
  name: "playground.instance.remove",
  description:
    "Remove one playground instance (a prompt or an evaluator task). Use this only " +
    "when the user asks to delete or remove a comparison instance. Pass the numeric " +
    "`instanceId`; use alphabetic labels (A, B, C, D) only when discussing instances " +
    "with the user. The playground must keep at least one instance, so this tool is " +
    "rejected when only one instance remains; removing every other instance also " +
    "unlocks the page's task kind. The removal is a state change covered by the " +
    "script-level approval (write_description).",
  inputSchema: removePromptInstanceInputSchema,
  operationKind: "approval",
  requireSession: true,
  UIBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Prompt instance removed.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `edit_prompt_instance` client-action tool.
 * Editing is an approval operation: the browser renders an inline diff and
 * the promise resolves only after the user accepts or rejects it.
 */
export const editPromptOperation = defineUIOperation({
  name: "playground.prompt.edit",
  description:
    "Edit one playground prompt instance. The edit is a state change covered by the " +
    "script-level approval (write_description). " +
    "Call `playground.prompt.read` before your first edit and pass its " +
    "`revision` as `expectedRevision`. Edits are rejected if the prompt changed since " +
    "that read — but a successful edit returns the new `revision`, which is valid as " +
    "the next `expectedRevision`, so chained edits need no re-read between them. " +
    "Use the alphabetic label from `playground.prompt.read` (A, B, C, D) when telling the user " +
    "which instance is being edited, but pass the numeric `instanceId` when calling " +
    "this tool. " +
    "Use message IDs from `playground.prompt.read` for updates, deletes, insertion anchors, and " +
    "reorders. `operations` must always be an array, even for one edit. Use camelCase " +
    "field names exactly as shown. Common valid examples: " +
    '{"type":"update_message","messageId":1,"content":"new text"}; ' +
    '{"type":"insert_message","afterMessageId":1,"role":"user",' +
    '"content":"new text"}; ' +
    '{"type":"delete_message","messageId":1}; ' +
    '{"type":"reorder_messages","messageIds":[1,2,3]}. ' +
    "On an evaluator page this edits the LLM evaluator's judge prompt (the " +
    "instance's prompt); its name, outputs and mapping are edited with " +
    "`playground.evaluator.edit`.",
  inputSchema: editPromptInputSchema,
  // The approval resolution: `status` says what the user decided; on accept,
  // `revision` is the new token (valid as the next `expectedRevision`) and
  // `summary` counts the applied diff.
  outputSchema: z.object({
    status: z.enum(["accepted", "rejected"]),
    instanceId: z.number(),
    message: z.string(),
    acceptedBy: z.string().optional(),
    revision: z.string().optional(),
    summary: z
      .object({
        instanceIndex: z.number(),
        instanceLabel: z.string(),
        additions: z.number(),
        deletions: z.number(),
      })
      .optional(),
  }),
  operationKind: "approval",
  requireSession: true,
  UIBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Prompt edits applied.",
  availability: {
    routeHint: PLAYGROUND_PROMPT_ROUTE_HINT,
  },
});

/** All playground prompt-instance operations, for catalog assembly. */
export const playgroundPromptOperations: UIOperationDescriptor[] = [
  readPromptOperation,
  clonePromptInstanceOperation,
  addPromptInstanceOperation,
  removePromptInstanceOperation,
  editPromptOperation,
];
