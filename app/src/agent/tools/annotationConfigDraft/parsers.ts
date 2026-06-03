import {
  editAnnotationConfigDraftInputSchema,
  openAnnotationConfigFormInputSchema,
  readAnnotationConfigDraftInputSchema,
} from "./schemas";
import type {
  EditAnnotationConfigDraftInput,
  OpenAnnotationConfigFormInput,
  ReadAnnotationConfigDraftInput,
} from "./types";

export function parseReadAnnotationConfigDraftInput(
  input: unknown
): ReadAnnotationConfigDraftInput | null {
  return readAnnotationConfigDraftInputSchema.safeParse(input).data ?? null;
}

export function parseOpenAnnotationConfigFormInput(
  input: unknown
): OpenAnnotationConfigFormInput | null {
  return openAnnotationConfigFormInputSchema.safeParse(input).data ?? null;
}

export function parseEditAnnotationConfigDraftInput(
  input: unknown
): EditAnnotationConfigDraftInput | null {
  return editAnnotationConfigDraftInputSchema.safeParse(input).data ?? null;
}
