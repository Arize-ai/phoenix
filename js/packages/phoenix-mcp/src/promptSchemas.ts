import z from "zod";

export const listPromptsSchema = z.object({
  limit: z.number().min(1).max(100).default(100),
});

export const getLatestPromptSchema = z.object({
  prompt_identifier: z.string(),
});

export const getPromptByIdentifierSchema = z.object({
  prompt_identifier: z.string(),
});

export const getPromptVersionSchema = z.object({
  prompt_version_id: z.string(),
});

export const createPromptSchema = z.object({
  name: z
    .string()
    .transform(
      (val) =>
        val
          .toLowerCase()
          .replace(/\s+/g, "_") // Replace spaces with underscores
          .replace(/[^\w_]/g, "") // Remove anything that's not alphanumeric or underscore
    )
    .refine((val) => val.length > 0, {
      message: "Name cannot be empty after transformation",
    }),
  description: z.string().optional(),
  template: z.string(),
  model_provider: z
    .enum(["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GOOGLE"])
    .optional()
    .default("OPENAI"),
  model_name: z.string().optional().default("gpt-4"),
  temperature: z.number().optional().default(0.7),
});

export const updatePromptSchema = z.object({
  prompt_identifier: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  template: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const deletePromptSchema = z.object({
  prompt_identifier: z.string(),
});

export const listPromptVersionsSchema = z.object({
  prompt_identifier: z.string(),
  limit: z.number().min(1).max(100).default(100),
});

export const getPromptVersionByTagSchema = z.object({
  prompt_identifier: z.string(),
  tag_name: z.string(),
});

export const listPromptVersionTagsSchema = z.object({
  prompt_version_id: z.string(),
  limit: z.number().min(1).max(100).default(100),
});

export const addPromptVersionTagSchema = z.object({
  prompt_version_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export type ListPromptsInput = z.infer<typeof listPromptsSchema>;
export type GetLatestPromptInput = z.infer<typeof getLatestPromptSchema>;
export type GetPromptByIdentifierInput = z.infer<
  typeof getPromptByIdentifierSchema
>;
export type GetPromptVersionInput = z.infer<typeof getPromptVersionSchema>;
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;
export type DeletePromptInput = z.infer<typeof deletePromptSchema>;
export type ListPromptVersionsInput = z.infer<typeof listPromptVersionsSchema>;
export type GetPromptVersionByTagInput = z.infer<
  typeof getPromptVersionByTagSchema
>;
export type ListPromptVersionTagsInput = z.infer<
  typeof listPromptVersionTagsSchema
>;
export type AddPromptVersionTagInput = z.infer<
  typeof addPromptVersionTagSchema
>;
