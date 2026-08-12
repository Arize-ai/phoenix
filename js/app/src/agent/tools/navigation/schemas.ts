import { z } from "zod";

// The only schema for the `navigation.goTo` operation input. `reason` is a
// first-class field (like `execute_ui`'s `summary`): it is the user-facing
// intent rendered in the approval card, so it is required and non-empty.
export const navigationGoToInputSchema = z.object({
  path: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});
