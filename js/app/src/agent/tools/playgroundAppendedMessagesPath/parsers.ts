import { setAppendedMessagesPathInputSchema } from "./schemas";
import type { SetAppendedMessagesPathInput } from "./types";

export function parseSetAppendedMessagesPathInput(
  input: unknown
): SetAppendedMessagesPathInput | null {
  return setAppendedMessagesPathInputSchema.safeParse(input).data ?? null;
}
