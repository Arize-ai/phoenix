import { savePromptInputSchema } from "./schemas";
import type { SavePromptInput } from "./types";

export function parseSavePromptInput(input: unknown): SavePromptInput | null {
  return savePromptInputSchema.safeParse(input).data ?? null;
}
