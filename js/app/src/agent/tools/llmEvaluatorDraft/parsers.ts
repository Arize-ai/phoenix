import {
  editLlmEvaluatorDraftActionContextSchema,
  editLlmEvaluatorDraftInputSchema,
  readLlmEvaluatorDraftInputSchema,
  testLlmEvaluatorDraftInputSchema,
} from "./schemas";
import type {
  EditLlmEvaluatorDraftActionContext,
  EditLlmEvaluatorDraftInput,
  ReadLlmEvaluatorDraftInput,
  TestLlmEvaluatorDraftInput,
} from "./types";

export function parseReadLlmEvaluatorDraftInput(
  input: unknown
): ReadLlmEvaluatorDraftInput | null {
  return readLlmEvaluatorDraftInputSchema.safeParse(input).data ?? null;
}

export function parseTestLlmEvaluatorDraftInput(
  input: unknown
): TestLlmEvaluatorDraftInput | null {
  return testLlmEvaluatorDraftInputSchema.safeParse(input).data ?? null;
}

export function parseEditLlmEvaluatorDraftInput(
  input: unknown
): EditLlmEvaluatorDraftInput | null {
  return editLlmEvaluatorDraftInputSchema.safeParse(input).data ?? null;
}

export function parseEditLlmEvaluatorDraftActionContext(
  input: unknown
): EditLlmEvaluatorDraftActionContext | null {
  return editLlmEvaluatorDraftActionContextSchema.safeParse(input).data ?? null;
}
