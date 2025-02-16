import { createClient } from "../client";
import { ClientFn } from "../types/core";
import {
  PromptData,
  PromptVersionData,
  PromptVersion,
  OpenAIInvocationParameters,
  AzureOpenAIInvocationParameters,
  AnthropicInvocationParameters,
  GeminiInvocationParameters,
  PromptChatMessage,
} from "../types/prompts";
import { assertUnreachable } from "../utils/assertUnreachable";

/**
 * Parameters to crate a prompt
 */
export interface CreatePromptParams extends ClientFn, PromptData {
  /**
   * The name of the promt
   */
  name: string;
  /**
   * The description of the prompt
   */
  description?: string;
  /**
   * The prompt version to push onto the history of the prompt
   */
  version: PromptVersionData;
}

/**
 * Create a prompt and store it in Phoenix
 * If a prompt with the same name exists, a new version of the prompt will be appended to the history
 */
export async function createPrompt({
  client: _client,
  version,
  ...promptParams
}: CreatePromptParams): Promise<PromptVersion> {
  const client = _client ?? createClient();
  const response = await client.POST("/v1/prompts", {
    body: {
      prompt: promptParams,
      version: version,
    },
  });
  const createdPromptVersion = response.data?.data;
  if (!createdPromptVersion) {
    throw new Error("Failed to create prompt");
  }
  return createdPromptVersion;
}

interface PromptVersionInputBase {
  description?: string;
  model_name: PromptVersionData["model_name"];
  /**
   * The template for the prompt version.
   * Currently only chat is supported.
   */
  template: PromptChatMessage[];
  /**
   * The format of the template.
   * Currently only MUSTACHE is supported.
   */
  template_format?: PromptVersionData["template_format"];
}

interface OpenAIPromptVersionInput extends PromptVersionInputBase {
  model_provider: "OPENAI";
  invocation_parameters?: OpenAIInvocationParameters;
}

interface AzureOpenAIPromptVersionInput extends PromptVersionInputBase {
  model_provider: "AZURE_OPENAI";
  invocation_parameters?: AzureOpenAIInvocationParameters;
}

interface AnthropicPromptVersionInput extends PromptVersionInputBase {
  model_provider: "ANTHROPIC";
  /**
   * The invocation parameters for the prompt version.
   * For Anthropic, the invocation parameters are required since max_tokens is required.
   */
  invocation_parameters: AnthropicInvocationParameters;
}

interface GeminiPromptVersionInput extends PromptVersionInputBase {
  model_provider: "GEMINI";
  invocation_parameters?: GeminiInvocationParameters;
}

type PromptVersionInput =
  | OpenAIPromptVersionInput
  | AzureOpenAIPromptVersionInput
  | AnthropicPromptVersionInput
  | GeminiPromptVersionInput;

/**
 * A helper function to construct a prompt version declaratively
 */
export function promptVersion(params: PromptVersionInput): PromptVersionData {
  const {
    description = "",
    model_provider,
    model_name,
    template: templateMessages,
    template_format = "MUSTACHE",
    invocation_parameters,
  } = params;
  switch (model_provider) {
    case "OPENAI":
      return {
        description,
        model_provider,
        model_name,
        template_type: "CHAT",
        template_format,
        template: {
          type: "chat",
          messages: templateMessages,
        },
        invocation_parameters: {
          type: "openai",
          openai: invocation_parameters ?? {},
        },
      };
    case "AZURE_OPENAI":
      return {
        description,
        model_provider,
        model_name,
        template_type: "CHAT",
        template_format,
        template: {
          type: "chat",
          messages: templateMessages,
        },
        invocation_parameters: {
          type: "azure_openai",
          azure_openai: invocation_parameters ?? {},
        },
      };
    case "ANTHROPIC":
      return {
        description,
        model_provider,
        model_name,
        template_type: "CHAT",
        template_format,
        template: {
          type: "chat",
          messages: templateMessages,
        },
        invocation_parameters: {
          type: "anthropic",
          anthropic: invocation_parameters,
        },
      };
    case "GEMINI":
      return {
        description,
        model_provider,
        model_name,
        template_type: "CHAT",
        template_format,
        template: {
          type: "chat",
          messages: templateMessages,
        },
        invocation_parameters: {
          type: "gemini",
          gemini: invocation_parameters ?? {},
        },
      };
    default:
      assertUnreachable(model_provider);
  }
}
