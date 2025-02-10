import z from "zod";
import { schemaMatches } from "../../../utils/schemaMatches";
import { PromptTool } from "../../../types/prompts";

/**
 * The Phoenix tool definition schema
 */
export const phoenixPromptToolDefinitionSchema = schemaMatches<PromptTool>()(
  z.object({
    type: z.literal("function-tool"),
    name: z.string(),
    description: z.string().optional(),
    schema: z
      .object({
        type: z.literal("json-schema-draft-7-object-schema"),
        json: z.record(z.unknown()),
      })
      .optional(),
    extra_parameters: z.record(z.unknown()).optional(),
  })
);

export type PhoenixPromptToolDefinition = z.infer<
  typeof phoenixPromptToolDefinitionSchema
>;
