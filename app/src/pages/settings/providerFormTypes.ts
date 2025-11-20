import { z } from "zod";

import { stringToHttpHeadersSchema } from "@phoenix/schemas/httpHeadersSchema";

// Base schema shared across all provider types
const baseProviderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  provider: z.string().min(1, "Provider is required"),
});

// Helper for common fields
const requiredString = z.string().min(1, "Required");
const optionalString = z.string().optional();
const headersSchema = optionalString.refine(
  (val) => {
    if (!val) return true;
    const result = stringToHttpHeadersSchema.safeParse(val);
    return result.success;
  },
  { message: "Invalid headers JSON" }
);

// OpenAI
export const openAISchema = baseProviderSchema.extend({
  sdk: z.literal("OPENAI"),
  openai_api_key: requiredString,
  openai_api_key_is_env_var: z.boolean().optional(),
  openai_base_url: optionalString,
  openai_base_url_is_env_var: z.boolean().optional(),
  openai_organization: optionalString,
  openai_organization_is_env_var: z.boolean().optional(),
  openai_project: optionalString,
  openai_project_is_env_var: z.boolean().optional(),
  openai_default_headers: headersSchema,
});

// Azure OpenAI
export const azureOpenAISchema = baseProviderSchema
  .extend({
    sdk: z.literal("AZURE_OPENAI"),
    azure_endpoint: requiredString,
    azure_endpoint_is_env_var: z.boolean().optional(),
    azure_deployment_name: requiredString,
    azure_deployment_name_is_env_var: z.boolean().optional(),
    azure_api_version: requiredString,
    azure_api_version_is_env_var: z.boolean().optional(),
    azure_auth_method: z.enum(["api_key", "ad_token", "ad_token_provider"]),
    azure_api_key: optionalString,
    azure_api_key_is_env_var: z.boolean().optional(),
    azure_ad_token: optionalString,
    azure_ad_token_is_env_var: z.boolean().optional(),
    azure_tenant_id: optionalString,
    azure_tenant_id_is_env_var: z.boolean().optional(),
    azure_client_id: optionalString,
    azure_client_id_is_env_var: z.boolean().optional(),
    azure_client_secret: optionalString,
    azure_client_secret_is_env_var: z.boolean().optional(),
    azure_scope: optionalString,
    azure_scope_is_env_var: z.boolean().optional(),
    azure_default_headers: headersSchema,
  })
  .superRefine((data, ctx) => {
    if (data.azure_auth_method === "api_key" && !data.azure_api_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API Key is required",
        path: ["azure_api_key"],
      });
    }
    if (data.azure_auth_method === "ad_token" && !data.azure_ad_token) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AD Token is required",
        path: ["azure_ad_token"],
      });
    }
    if (data.azure_auth_method === "ad_token_provider") {
      if (!data.azure_tenant_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tenant ID is required",
          path: ["azure_tenant_id"],
        });
      }
      if (!data.azure_client_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client ID is required",
          path: ["azure_client_id"],
        });
      }
      if (!data.azure_client_secret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client Secret is required",
          path: ["azure_client_secret"],
        });
      }
    }
  });

// Anthropic
export const anthropicSchema = baseProviderSchema.extend({
  sdk: z.literal("ANTHROPIC"),
  anthropic_api_key: requiredString,
  anthropic_api_key_is_env_var: z.boolean().optional(),
  anthropic_base_url: optionalString,
  anthropic_base_url_is_env_var: z.boolean().optional(),
  anthropic_default_headers: headersSchema,
});

// AWS Bedrock
export const awsBedrockSchema = baseProviderSchema.extend({
  sdk: z.literal("AWS_BEDROCK"),
  aws_region: requiredString,
  aws_region_is_env_var: z.boolean().optional(),
  aws_access_key_id: requiredString,
  aws_access_key_id_is_env_var: z.boolean().optional(),
  aws_secret_access_key: requiredString,
  aws_secret_access_key_is_env_var: z.boolean().optional(),
  aws_session_token: optionalString,
  aws_session_token_is_env_var: z.boolean().optional(),
});

// Google GenAI
export const googleGenAISchema = baseProviderSchema.extend({
  sdk: z.literal("GOOGLE_GENAI"),
  google_api_key: requiredString,
  google_api_key_is_env_var: z.boolean().optional(),
  google_base_url: optionalString,
  google_base_url_is_env_var: z.boolean().optional(),
  google_headers: headersSchema,
});

// DeepSeek
export const deepSeekSchema = baseProviderSchema.extend({
  sdk: z.literal("OPENAI"),
  provider: z.literal("deepseek"),
  deepseek_api_key: requiredString,
  deepseek_api_key_is_env_var: z.boolean().optional(),
  deepseek_base_url: optionalString,
  deepseek_base_url_is_env_var: z.boolean().optional(),
  deepseek_organization: optionalString,
  deepseek_organization_is_env_var: z.boolean().optional(),
  deepseek_project: optionalString,
  deepseek_project_is_env_var: z.boolean().optional(),
  deepseek_default_headers: headersSchema,
});

// xAI
export const xAISchema = baseProviderSchema.extend({
  sdk: z.literal("OPENAI"),
  provider: z.literal("xai"),
  xai_api_key: requiredString,
  xai_api_key_is_env_var: z.boolean().optional(),
  xai_base_url: optionalString,
  xai_base_url_is_env_var: z.boolean().optional(),
  xai_organization: optionalString,
  xai_organization_is_env_var: z.boolean().optional(),
  xai_project: optionalString,
  xai_project_is_env_var: z.boolean().optional(),
  xai_default_headers: headersSchema,
});

// Ollama
export const ollamaSchema = baseProviderSchema.extend({
  sdk: z.literal("OPENAI"),
  provider: z.literal("ollama"),
  ollama_base_url: optionalString,
  ollama_base_url_is_env_var: z.boolean().optional(),
  ollama_organization: optionalString,
  ollama_organization_is_env_var: z.boolean().optional(),
  ollama_project: optionalString,
  ollama_project_is_env_var: z.boolean().optional(),
  ollama_default_headers: headersSchema,
});

// Union of all provider schemas
// Note: Can't use discriminatedUnion with superRefine, so using regular union
export const providerFormSchema = z.union([
  openAISchema,
  azureOpenAISchema,
  anthropicSchema,
  awsBedrockSchema,
  googleGenAISchema,
  deepSeekSchema,
  xAISchema,
  ollamaSchema,
]);

export type OpenAIFormData = z.infer<typeof openAISchema>;
export type AzureOpenAIFormData = z.infer<typeof azureOpenAISchema>;
export type AnthropicFormData = z.infer<typeof anthropicSchema>;
export type AWSBedrockFormData = z.infer<typeof awsBedrockSchema>;
export type GoogleGenAIFormData = z.infer<typeof googleGenAISchema>;
export type DeepSeekFormData = z.infer<typeof deepSeekSchema>;
export type XAIFormData = z.infer<typeof xAISchema>;
export type OllamaFormData = z.infer<typeof ollamaSchema>;

export type ProviderFormData =
  | OpenAIFormData
  | AzureOpenAIFormData
  | AnthropicFormData
  | AWSBedrockFormData
  | GoogleGenAIFormData
  | DeepSeekFormData
  | XAIFormData
  | OllamaFormData;

export interface ProviderFormProps {
  onSubmit: (data: ProviderFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<ProviderFormData>;
  isSubmitting?: boolean;
}
