import {
  createAnnotationConfigInputSchema,
  updateAnnotationConfigInputSchema,
} from "./schemas";
import type {
  CreateAnnotationConfigInput,
  UpdateAnnotationConfigInput,
} from "./types";

export function parseCreateAnnotationConfigInput(
  input: unknown
): CreateAnnotationConfigInput | null {
  return createAnnotationConfigInputSchema.safeParse(input).data ?? null;
}

export function parseUpdateAnnotationConfigInput(
  input: unknown
): UpdateAnnotationConfigInput | null {
  return updateAnnotationConfigInputSchema.safeParse(input).data ?? null;
}
