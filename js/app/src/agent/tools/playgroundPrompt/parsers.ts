import {
  addPromptInstanceInputSchema,
  clonePromptInstanceInputSchema,
  editPromptActionContextSchema,
  editPromptInputSchema,
  readPromptInputSchema,
  removePromptInstanceInputSchema,
  removePromptInstanceOutputSchema,
} from "./schemas";
import type {
  AddPromptInstanceInput,
  ClonePromptInstanceInput,
  EditPromptActionContext,
  EditPromptInput,
  ReadPromptInput,
  RemovePromptInstanceInput,
  RemovePromptInstanceOutput,
} from "./types";

export function parseReadPromptInput(input: unknown): ReadPromptInput | null {
  return readPromptInputSchema.safeParse(input).data ?? null;
}

export function parseClonePromptInstanceInput(
  input: unknown
): ClonePromptInstanceInput | null {
  return clonePromptInstanceInputSchema.safeParse(input).data ?? null;
}

export function parseAddPromptInstanceInput(
  input: unknown
): AddPromptInstanceInput | null {
  return addPromptInstanceInputSchema.safeParse(input).data ?? null;
}

export function parseRemovePromptInstanceInput(
  input: unknown
): RemovePromptInstanceInput | null {
  return removePromptInstanceInputSchema.safeParse(input).data ?? null;
}

export function parseRemovePromptInstanceOutput(
  output: unknown
): RemovePromptInstanceOutput | null {
  return removePromptInstanceOutputSchema.safeParse(output).data ?? null;
}

export function parseEditPromptInput(input: unknown): EditPromptInput | null {
  return editPromptInputSchema.safeParse(input).data ?? null;
}

export function parseEditPromptActionContext(
  input: unknown
): EditPromptActionContext | null {
  return editPromptActionContextSchema.safeParse(input).data ?? null;
}
