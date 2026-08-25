import {
  editCodeEvaluatorDraftInputSchema,
  readCodeEvaluatorDraftInputSchema,
  testCodeEvaluatorDraftInputSchema,
} from "./schemas";
import type {
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
