import {
  listPlaygroundModelTargetsInputSchema,
  setPlaygroundModelInputSchema,
} from "./schemas";
import type {
  ListPlaygroundModelTargetsInput,
  SetPlaygroundModelInput,
} from "./types";

export function parseListPlaygroundModelTargetsInput(
  input: unknown
): ListPlaygroundModelTargetsInput | null {
  return listPlaygroundModelTargetsInputSchema.safeParse(input).data ?? null;
}

export function parseSetPlaygroundModelInput(
  input: unknown
): SetPlaygroundModelInput | null {
  return setPlaygroundModelInputSchema.safeParse(input).data ?? null;
}
