import { createClient } from "../client";
import { ClientFn } from "../types/core";
import {
  PromptData,
  PromptVersionData,
  PromptVersion,
  OpenAIInvocationParameters,
  AzureOpenAIInvocationParameters,
  AnthropicInvocationParameters,
  GoogleInvocationParameters,
  DeepSeekInvocationParameters,
  XAIInvocationParameters,
  OllamaInvocationParameters,
  AwsInvocationParameters,
  PromptChatMessage,
} from "../types/prompts";
import { assertUnreachable } from "../utils/assertUnreachable";

/**
 * Parameters to create a prompt
 */
export interface CreatePromptParams extends ClientFn, PromptData {
  /**
   * The name of the prompt
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
 * Create a prompt and store it in Phoenix.
 *
 * If a prompt with the same name exists, a new version of the prompt will be appended to the history.
 *
 * @param params - The parameters to create a prompt.
 * @returns The created prompt version.
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
  /**
   * The description of the prompt version.
   */
  description?: string;
  /**
   * The name of the model to use for the prompt version.
   */
  modelName: PromptVersionData["model_name"];
  /**
   * The template for the prompt version.
   * Currently only chat is supported.
   */
  template: PromptChatMessage[];
  /**
   * The format of the template.
   * @default "MUSTACHE"
   */
  templateFormat?: PromptVersionData["template_format"];
}

export interface OpenAIPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "OPENAI";
  invocationParameters?: OpenAIInvocationParameters;
}

export interface AzureOpenAIPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "AZURE_OPENAI";
  invocationParameters?: AzureOpenAIInvocationParameters;
}

export interface AnthropicPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "ANTHROPIC";
  /**
   * The invocation parameters for the prompt version.
   * For Anthropic, the invocation parameters are required since max_tokens is required.
   */
  invocationParameters: AnthropicInvocationParameters;
}

export interface GooglePromptVersionInput extends PromptVersionInputBase {
  modelProvider: "GOOGLE";
  invocationParameters?: GoogleInvocationParameters;
}

export interface DeepSeekPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "DEEPSEEK";
  invocationParameters?: DeepSeekInvocationParameters;
}

export interface XAIPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "XAI";
  invocationParameters?: XAIInvocationParameters;
}

export interface OllamaPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "OLLAMA";
  invocationParameters?: OllamaInvocationParameters;
}

export interface AwsPromptVersionInput extends PromptVersionInputBase {
  modelProvider: "AWS";
  invocationParameters?: AwsInvocationParameters;
}

export type PromptVersionInput =
  | OpenAIPromptVersionInput
  | AzureOpenAIPromptVersionInput
  | AnthropicPromptVersionInput
  | GooglePromptVersionInput
  | DeepSeekPromptVersionInput
  | XAIPromptVersionInput
  | OllamaPromptVersionInput
  | AwsPromptVersionInput;

/**
 * A helper function to construct a prompt version declaratively.
 *
 * The output of this function can be used to create a prompt version in Phoenix.
 *
 * @param params - The parameters to create a prompt version.
 * @returns Structured prompt version data, not yet persisted to Phoenix.
 */
export function promptVersion(params: PromptVersionInput): PromptVersionData {
  const {
    description = "",
    modelProvider: model_provider,
    modelName: model_name,
    template: templateMessages,
    templateFormat: template_format = "MUSTACHE",
    invocationParameters: invocation_parameters,
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
    case "GOOGLE":
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
          type: "google",
          google: invocation_parameters ?? {},
        },
      };
    case "DEEPSEEK":
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
          type: "deepseek",
          deepseek: invocation_parameters ?? {},
        },
      };
    case "XAI":
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
          type: "xai",
          xai: invocation_parameters ?? {},
        },
      };
    case "OLLAMA":
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
          type: "ollama",
          ollama: invocation_parameters ?? {},
        },
      };
    case "AWS":
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
          type: "aws",
          aws: invocation_parameters ?? {},
        },
      };
    default:
      assertUnreachable(model_provider);
  }
}
