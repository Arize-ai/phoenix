import { z } from "zod";

import { toolCallPartSchema } from "./messagePartSchemas";

export const promptToolCallSchema = toolCallPartSchema;

export type PromptToolCall = z.infer<typeof promptToolCallSchema>;
