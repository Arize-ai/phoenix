import {
  readPromptToolsInputSchema,
  writePromptToolsInputSchema,
} from "./schemas";
import type { ReadPromptToolsInput, WritePromptToolsInput } from "./types";

export function parseReadPromptToolsInput(
  input: unknown
): ReadPromptToolsInput | null {
  return readPromptToolsInputSchema.safeParse(input).data ?? null;
}

export function parseWritePromptToolsInput(
  input: unknown
): WritePromptToolsInput | null {
  return writePromptToolsInputSchema.safeParse(input).data ?? null;
}
