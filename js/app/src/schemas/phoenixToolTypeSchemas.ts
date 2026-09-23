/**
 * A Phoenix tool type is a pre-defined tool json that pre-configures
 * a tool for a specific use case.
 *
 * They are represented using the openAIChatCompletionsToolDefinitionSchema schema.
 */

import z from "zod";

import { openAIChatCompletionsToolDefinitionSchema } from "@phoenix/schemas/toolSchemas";

export const PhoenixToolEditorTypeSchema = z.union([
  z.literal("json"),
  z.literal("categorical_choice"),
]);

export type PhoenixToolEditorType = z.infer<typeof PhoenixToolEditorTypeSchema>;

export const CategoricalChoiceToolTypeSchema =
  openAIChatCompletionsToolDefinitionSchema.extend({
    function: openAIChatCompletionsToolDefinitionSchema.shape.function.extend({
      parameters: z.object({
        type: z.literal("object"),
        properties: z.partialRecord(
          z.union([z.literal("label"), z.literal("explanation")]),
          z.union([
            z.object({
              type: z.literal("string"),
              enum: z.array(z.string()),
              description: z.string(),
            }),
            z.object({
              type: z.literal("string"),
              description: z.string(),
            }),
          ])
        ),
        required: z.array(z.string()),
      }),
    }),
  });

export type CategoricalChoiceToolType = z.infer<
  typeof CategoricalChoiceToolTypeSchema
>;

export const CategoricalChoiceToolTypeJSONSchema = z.toJSONSchema(
  CategoricalChoiceToolTypeSchema
);

// export const PhoenixToolTypeSchema = z.union([CategoricalChoiceToolTypeSchema]);
