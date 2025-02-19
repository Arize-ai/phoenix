import z from "zod";
import { schemaMatches } from "../../../utils/schemaMatches";
import { PromptTool } from "../../../types/prompts";

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
