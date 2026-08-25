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

/** Route hint shared by every playground operation. */
const PLAYGROUND_ROUTE_HINT =
  "the Prompt Playground page (a /playground route)";

/**
 * Documentation-only mirror of {@link PromptSnapshot} — what
 * `playground.prompt.read` resolves with. Kept approximate on purpose (see
 * `outputSchema` on the descriptor type): the top-level field names are what
 * scripts branch on.
 */
const promptSnapshotOutputSchema = z.object({
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
    "there are multiple comparison instances, pass the specific `instanceId`.",
  inputSchema: readPromptInputSchema,
  outputSchema: promptSnapshotOutputSchema,
  operationKind: "read",
  defaultSuccessOutput: "Prompt instance read.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `clone_prompt_instance` client-action tool.
 */
export const clonePromptInstanceOperation = defineUIOperation({
  name: "playground.instance.clone",
  description:
    "Clone an existing playground prompt instance into a new comparison instance. " +
    "Use this before proposing prompt edits when the user wants to compare a variant " +
    "against the original. If there is exactly one playground instance, `instanceId` " +
    "may be omitted. If there are multiple comparison instances, pass the specific " +
    "`instanceId` to clone. Use the alphabetic labels (A, B, C, D) when discussing " +
    "instances with the user, but pass numeric instance IDs when calling tools. The " +
    "playground supports at most 4 comparison instances; this tool is rejected when " +
    "4 instances already exist. The cloned instance receives fresh message IDs; call " +
    "`playground.prompt.read` on the cloned instance before editing it.",
  inputSchema: clonePromptInstanceInputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Prompt instance cloned.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/**
 * The catalog entry replacing the `add_prompt_instance` client-action tool.
 */
export const addPromptInstanceOperation = defineUIOperation({
  name: "playground.instance.add",
  description:
    "Add a fresh chat prompt instance to the mounted playground for comparison. " +
    "Use this when the user wants a new prompt variant that starts from the default " +
    "chat prompt messages instead of copying existing prompt messages. The new " +
    "instance inherits runnable playground configuration from the current playground " +
    "but has no saved prompt association. The playground supports at most 4 comparison " +
    "instances; this tool is rejected when 4 instances already exist. The output " +
    "includes an `addedInstance` snapshot with the instance ID, message IDs, and " +
    "revision needed to edit the new instance.",
  inputSchema: addPromptInstanceInputSchema,
  operationKind: "write",
  defaultSuccessOutput: "Prompt instance added.",
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
    "Remove one playground prompt instance. Use this only when the user asks to " +
    "delete or remove a comparison instance. Pass the numeric `instanceId`; use " +
    "alphabetic labels (A, B, C, D) only when discussing instances with the user. " +
    "The playground must keep at least one prompt instance, so this tool is rejected " +
    "when only one instance remains. In manual approval mode the browser asks the " +
    "user to accept or reject the removal; in bypass mode it removes immediately.",
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
    "Propose edits to one playground prompt instance. This tool does not change the " +
    "prompt immediately: the browser renders an inline diff and the user must accept " +
    "or reject it. Call `playground.prompt.read` before your first edit and pass its " +
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
    '{"type":"reorder_messages","messageIds":[1,2,3]}.',
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
    routeHint: PLAYGROUND_ROUTE_HINT,
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
