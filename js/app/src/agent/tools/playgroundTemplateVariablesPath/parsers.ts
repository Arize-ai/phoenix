import { setTemplateVariablesPathInputSchema } from "./schemas";
import type { SetTemplateVariablesPathInput } from "./types";

export function parseSetTemplateVariablesPathInput(
  input: unknown
): SetTemplateVariablesPathInput | null {
  return setTemplateVariablesPathInputSchema.safeParse(input).data ?? null;
}
