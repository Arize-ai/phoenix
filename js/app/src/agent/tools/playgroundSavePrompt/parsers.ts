import { savePromptInputSchema, savePromptOutputSchema } from "./schemas";
import type { SavePromptInput, SavePromptOutput } from "./types";

export function parseSavePromptInput(input: unknown): SavePromptInput | null {
  return savePromptInputSchema.safeParse(input).data ?? null;
}

export function parseSavePromptResult(
  output: unknown
): SavePromptOutput | null {
  return savePromptOutputSchema.safeParse(output).data ?? null;
}
