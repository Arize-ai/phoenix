import { toolCallPartSchema } from "./messagePartSchemas";

import z from "zod";

export const phoenixToolCallSchema = toolCallPartSchema;

export type PhoenixToolCall = z.infer<typeof phoenixToolCallSchema>;
