import { z } from "zod";

export const setAppendedMessagesPathInputSchema = z
  .object({ path: z.string().nullable() })
  .strict();
