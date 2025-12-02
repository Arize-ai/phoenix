import { z } from "zod";

import { validateJsonField } from "./customProviderFormUtils";

// Custom refinement for JSON fields using superRefine to avoid double validation
const jsonFieldSchema = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    const result = validateJsonField(val);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error,
      });
    }
  });

// Base schema shared by all providers
const baseProviderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  provider: z.string().min(1, "Provider is required"),
});

// OpenAI schema
const openAISchema = baseProviderSchema.extend({
  sdk: z.literal("OPENAI"),
  openai_api_key: z.string().min(1, "API key is required"),
  openai_base_url: z.string().optional(),
  openai_organization: z.string().optional(),
  openai_project: z.string().optional(),
  openai_default_headers: jsonFieldSchema,
});

// Azure OpenAI schema
const azureOpenAISchema = baseProviderSchema.extend({
  sdk: z.literal("AZURE_OPENAI"),
  azure_endpoint: z.string().min(1, "Endpoint is required"),
  azure_deployment_name: z.string().min(1, "Deployment name is required"),
  azure_api_version: z.string().min(1, "API version is required"),
  azure_auth_method: z.enum(["api_key", "ad_token_provider"]),
  azure_api_key: z.string().optional(),
  azure_tenant_id: z.string().optional(),
  azure_client_id: z.string().optional(),
  azure_client_secret: z.string().optional(),
  azure_scope: z.string().optional(),
  azure_default_headers: jsonFieldSchema,
});

// Anthropic schema
const anthropicSchema = baseProviderSchema.extend({
  sdk: z.literal("ANTHROPIC"),
  anthropic_api_key: z.string().min(1, "API key is required"),
  anthropic_base_url: z.string().optional(),
  anthropic_default_headers: jsonFieldSchema,
});

// AWS Bedrock schema
const awsBedrockSchema = baseProviderSchema.extend({
  sdk: z.literal("AWS_BEDROCK"),
  aws_region: z.string().min(1, "Region is required"),
  aws_access_key_id: z.string().min(1, "Access key ID is required"),
  aws_secret_access_key: z.string().min(1, "Secret access key is required"),
  aws_session_token: z.string().optional(),
  aws_endpoint_url: z.string().optional(),
});

// Google GenAI schema
const googleGenAISchema = baseProviderSchema.extend({
  sdk: z.literal("GOOGLE_GENAI"),
  google_api_key: z.string().min(1, "API key is required"),
  google_base_url: z.string().optional(),
  google_headers: jsonFieldSchema,
});

// Discriminated union of all provider schemas
const baseProviderFormSchema = z.discriminatedUnion("sdk", [
  openAISchema,
  azureOpenAISchema,
  anthropicSchema,
  awsBedrockSchema,
  googleGenAISchema,
]);

// Add conditional validation for Azure auth methods on top of the discriminated union
export const providerFormSchema = baseProviderFormSchema.superRefine(
  (data, ctx) => {
    // Azure OpenAI conditional validation
    if (data.sdk === "AZURE_OPENAI") {
      if (data.azure_auth_method === "api_key") {
        // API key is required when using api_key auth
        if (!data.azure_api_key || data.azure_api_key.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "API key is required when using API key authentication",
            path: ["azure_api_key"],
          });
        }
      } else if (data.azure_auth_method === "ad_token_provider") {
        // AD fields are required when using AD token provider
        if (!data.azure_tenant_id || data.azure_tenant_id.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Tenant ID is required for AD Token Provider authentication",
            path: ["azure_tenant_id"],
          });
        }
        if (!data.azure_client_id || data.azure_client_id.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Client ID is required for AD Token Provider authentication",
            path: ["azure_client_id"],
          });
        }
        if (
          !data.azure_client_secret ||
          data.azure_client_secret.length === 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Client Secret is required for AD Token Provider authentication",
            path: ["azure_client_secret"],
          });
        }
      }
    }
  }
);
