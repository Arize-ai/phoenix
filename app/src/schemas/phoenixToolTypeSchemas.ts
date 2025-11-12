/**
 * A Phoenix tool type is a pre-defined tool json that pre-configures
 * a tool for a specific use case.
 *
 * They are represented using the openAIToolDefinitionSchema schema.
 */

import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { openAIToolDefinitionSchema } from "@phoenix/schemas/toolSchemas";

export const PhoenixToolEditorTypeSchema = z.union([
  z.literal("json"),
  z.literal("categorical_choice"),
]);

export type PhoenixToolEditorType = z.infer<typeof PhoenixToolEditorTypeSchema>;

export const CategoricalChoiceToolTypeSchema =
  openAIToolDefinitionSchema.extend({
    function: openAIToolDefinitionSchema.shape.function.extend({
      parameters: z.object({
        type: z.literal("string"),
        enum: z.array(z.string()),
        description: z.string().optional(),
        required: z.array(z.string()),
      }),
    }),
  });

export type CategoricalChoiceToolType = z.infer<
  typeof CategoricalChoiceToolTypeSchema
>;

export const CategoricalChoiceToolTypeJSONSchema = zodToJsonSchema(
  CategoricalChoiceToolTypeSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);

// export const PhoenixToolTypeSchema = z.union([CategoricalChoiceToolTypeSchema]);
