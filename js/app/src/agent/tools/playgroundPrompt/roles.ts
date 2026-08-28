import type { z } from "zod";

import { chatMessageRolesSchema } from "@phoenix/pages/playground/schemas";

export const VALID_MESSAGE_ROLES = chatMessageRolesSchema.options;

export type PromptMessageRole = z.infer<typeof chatMessageRolesSchema>;

export function parsePromptMessageRole(
  input: unknown
): PromptMessageRole | null {
  return typeof input === "string" &&
    chatMessageRolesSchema.safeParse(input).success
    ? (input as PromptMessageRole)
    : null;
}
