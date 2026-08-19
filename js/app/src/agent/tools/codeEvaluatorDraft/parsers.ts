import {
  editCodeEvaluatorDraftActionContextSchema,
  editCodeEvaluatorDraftInputSchema,
  readCodeEvaluatorDraftInputSchema,
  testCodeEvaluatorDraftInputSchema,
} from "./schemas";
import type {
  EditCodeEvaluatorDraftActionContext,
  EditCodeEvaluatorDraftInput,
  ReadCodeEvaluatorDraftInput,
  TestCodeEvaluatorDraftInput,
} from "./types";

export function parseReadCodeEvaluatorDraftInput(
  input: unknown
): ReadCodeEvaluatorDraftInput | null {
  return readCodeEvaluatorDraftInputSchema.safeParse(input).data ?? null;
}

export function parseEditCodeEvaluatorDraftInput(
  input: unknown
): EditCodeEvaluatorDraftInput | null {
  return editCodeEvaluatorDraftInputSchema.safeParse(input).data ?? null;
}

export function parseTestCodeEvaluatorDraftInput(
  input: unknown
): TestCodeEvaluatorDraftInput | null {
  return testCodeEvaluatorDraftInputSchema.safeParse(input).data ?? null;
}

export function parseEditCodeEvaluatorDraftActionContext(
  input: unknown
): EditCodeEvaluatorDraftActionContext | null {
  return (
    editCodeEvaluatorDraftActionContextSchema.safeParse(input).data ?? null
  );
}
