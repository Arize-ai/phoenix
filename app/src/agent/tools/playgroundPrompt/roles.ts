import type { z } from "zod";

import { chatMessageRolesSchema } from "@phoenix/pages/playground/schemas";

export const VALID_MESSAGE_ROLES = chatMessageRolesSchema.options;

export type PromptMessageRole = z.infer<typeof chatMessageRolesSchema>;

export function parsePromptMessageRole(
  input: unknown
): PromptMessageRole | null {
  const result = chatMessageRolesSchema.safeParse(input);
  return result.success ? result.data : null;
}
