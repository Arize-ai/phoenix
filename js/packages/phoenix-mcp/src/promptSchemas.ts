import z from "zod";

import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
  DEFAULT_TEMPERATURE,
} from "./constants.js";

export const listPromptsSchema = z.object({
  limit: z.number().min(1).max(100).default(100),
});

export const getLatestPromptSchema = z.object({
  prompt_identifier: z.string(),
});

export const getPromptSchema = z.object({
  prompt_identifier: z.string(),
  tag: z.string().optional(),
  version_id: z.string().optional(),
});

export const getPromptByIdentifierSchema = z.object({
  prompt_identifier: z.string(),
});

export const getPromptVersionSchema = z.object({
  prompt_version_id: z.string(),
});

/**
 * Name transformation applied to prompt names:
 * - lowercase
 * - spaces → underscores
 * - strip non-alphanumeric / non-underscore characters
 */
const promptNameSchema = z
  .string()
  .transform((val) =>
    val
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "")
  )
  .refine((val) => val.length > 0, {
    message: "Name cannot be empty after transformation",
  });

export const createPromptSchema = z.object({
  name: promptNameSchema,
  description: z.string().optional(),
  template: z.string(),
  model_provider: z
    .enum(["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GOOGLE"])
    .optional()
    .default(DEFAULT_MODEL_PROVIDER),
  model_name: z.string().optional().default(DEFAULT_MODEL_NAME),
  temperature: z.number().optional().default(DEFAULT_TEMPERATURE),
});

export const updatePromptSchema = z.object({
  prompt_identifier: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  template: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
export type GetPromptInput = z.infer<typeof getPromptSchema>;
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
