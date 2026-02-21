import z from "zod";

import type { PromptTool } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

/**
 * The Phoenix tool definition schema
 */
export const phoenixToolDefinitionSchema = schemaMatches<PromptTool>()(
  z.object({
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      description: z.string().optional(),
      parameters: z.record(z.unknown()).optional(),
      strict: z.boolean().optional(),
    }),
  })
);

export type PhoenixToolDefinition = z.infer<typeof phoenixToolDefinitionSchema>;
