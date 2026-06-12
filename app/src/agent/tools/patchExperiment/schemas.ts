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

// `description: null` clears it; omitting leaves it untouched. Keep the explicit
// null — the propose handler distinguishes clear-vs-omit via `"description" in input`.
const descriptionSchema = z.string().nullable();

const nameSchema = z.string().trim().min(1);

const metadataSchema = z.record(z.string(), z.unknown());

// Metadata is replaced as a whole object (no deep merge), so a caller appending
// notes must read current metadata and resubmit the full object.
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
