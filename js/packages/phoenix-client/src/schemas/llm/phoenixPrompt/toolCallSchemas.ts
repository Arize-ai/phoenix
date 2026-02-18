import z from "zod";

import { toolCallPartSchema } from "./messagePartSchemas";

export const phoenixToolCallSchema = toolCallPartSchema;

export type PhoenixToolCall = z.infer<typeof phoenixToolCallSchema>;
