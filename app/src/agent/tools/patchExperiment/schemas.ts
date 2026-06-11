import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { isGlobalIdOfType } from "@phoenix/utils/globalIdUtils";

export type PatchExperimentToolOutputSender = Chat<UIMessage>["addToolOutput"];

const experimentIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => isGlobalIdOfType(value, "Experiment"),
    "experimentId must be a valid Experiment GraphQL node ID."
  );

// `description: null` clears the description; omitting the field leaves it
// untouched. The propose handler distinguishes these by reading `"description"
// in input`, so the schema must preserve an explicit null rather than coercing
// it away.
const descriptionSchema = z.string().nullable();

const nameSchema = z.string().trim().min(1);

const metadataSchema = z.record(z.string(), z.unknown());

/**
 * Input for `patch_experiment`: a sparse edit of one experiment's name,
 * description, or metadata. The mutation replaces metadata as a whole object —
 * there is no deep merge — so callers appending notes must read current
 * metadata first and resubmit the full object.
 */
export const patchExperimentInputSchema = z
  .object({
    experimentId: experimentIdSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    metadata: metadataSchema.optional(),
  })
  .strict();

export const patchExperimentActionContextSchema = z.object({
  toolCallId: z.string(),
  sessionId: z.string(),
  addToolOutput: z.custom<PatchExperimentToolOutputSender>(
    (value) => typeof value === "function"
  ),
});
