import z from "zod";

import { toolCallPartSchema } from "./messagePartSchemas";

export const phoenixPromptToolCallSchema = toolCallPartSchema;

export type PhoenixPromptToolCall = z.infer<typeof phoenixPromptToolCallSchema>;
