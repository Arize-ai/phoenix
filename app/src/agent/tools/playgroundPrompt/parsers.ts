import {
  clonePromptInstanceInputSchema,
  editPromptActionContextSchema,
  editPromptInputSchema,
  readPromptInputSchema,
} from "./schemas";
import type {
  ClonePromptInstanceInput,
  EditPromptActionContext,
  EditPromptInput,
  ReadPromptInput,
} from "./types";

export function parseReadPromptInput(input: unknown): ReadPromptInput | null {
  return readPromptInputSchema.safeParse(input).data ?? null;
}

export function parseClonePromptInstanceInput(
  input: unknown
): ClonePromptInstanceInput | null {
  return clonePromptInstanceInputSchema.safeParse(input).data ?? null;
}

export function parseEditPromptInput(input: unknown): EditPromptInput | null {
  return editPromptInputSchema.safeParse(input).data ?? null;
}

export function parseEditPromptActionContext(
  input: unknown
): EditPromptActionContext | null {
  return editPromptActionContextSchema.safeParse(input).data ?? null;
}
