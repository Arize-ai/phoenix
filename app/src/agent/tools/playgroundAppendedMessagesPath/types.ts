import type { z } from "zod";

import type { setAppendedMessagesPathInputSchema } from "./schemas";

export type SetAppendedMessagesPathInput = z.output<
  typeof setAppendedMessagesPathInputSchema
>;
