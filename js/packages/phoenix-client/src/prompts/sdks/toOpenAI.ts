import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
} from "openai/resources";
import invariant from "tiny-invariant";

import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
  safelyConvertToolDefinitionToProvider,
} from "../../schemas/llm/converters";
import type { OpenaiToolChoice } from "../../schemas/llm/openai/toolChoiceSchemas";
import { phoenixResponseFormatToOpenAI } from "../../schemas/llm/phoenixPrompt/converters";
import { isPromptToolRaw } from "../../types/prompts";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import type { toSDKParamsBase, Variables } from "./types";

// We must re-export these types so that they are included in the phoenix-client distribution
export type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
};

export type ToOpenAIParams<PromptVariables extends Variables> =
  toSDKParamsBase<PromptVariables>;

type PhoenixPrompt = ToOpenAIParams<Variables>["prompt"];

function getInvocationParameters(
  prompt: PhoenixPrompt
): Partial<ChatCompletionCreateParams> {
  const parameters = prompt.invocation_parameters;
  switch (parameters.type) {
    case "openai":
      return parameters.openai;
    case "azure_openai":
      return parameters.azure_openai;
    case "deepseek":
      return parameters.deepseek;
    case "xai":
      return parameters.xai;
    case "ollama":
      return parameters.ollama;
    case "cerebras":
      return parameters.cerebras;
    case "fireworks":
      return parameters.fireworks;
    case "groq":
      return parameters.groq;
    case "moonshot":
      return parameters.moonshot;
    case "perplexity":
      return parameters.perplexity;
    case "together":
      return parameters.together;
    case "zai":
      return parameters.zai;
    default:
      // eslint-disable-next-line no-console
      console.warn(
        "Prompt is not an OpenAI-family prompt, falling back to default OpenAI invocation parameters"
      );
      return {};
  }
}

function getOpenAITools(
  prompt: PhoenixPrompt
): ChatCompletionCreateParams["tools"] {
  const toolsList = prompt.tools?.tools ?? [];
  if (toolsList.length === 0) return undefined;

  return toolsList.map((tool) => {
    if (isPromptToolRaw(tool)) return tool.raw;
    const definition = safelyConvertToolDefinitionToProvider({
      toolDefinition: tool,
      targetProvider: "OPENAI",
    });
    invariant(definition, "Tool definition is not valid");
    return definition;
  }) as unknown as ChatCompletionCreateParams["tools"];
}

/**
 * Convert a Phoenix prompt to OpenAI client sdk's chat completion parameters
 *
 * @returns The converted chat completion parameters
 */
export const toOpenAI = <PromptVariables extends Variables = Variables>({
  prompt,
  variables,
}: ToOpenAIParams<PromptVariables>): ChatCompletionCreateParams | null => {
  try {
    const invocationParameters = getInvocationParameters(prompt);
    // parts of the prompt that can be directly converted to OpenAI params
    const baseCompletionParams = {
      model: prompt.model_name,
      // Invocation parameters are validated on the phoenix-side
      ...invocationParameters,
    } satisfies Partial<ChatCompletionCreateParams>;

    if (!("messages" in prompt.template)) {
      return null;
    }

    let formattedMessages = prompt.template.messages;

    if (variables) {
      formattedMessages = formatPromptMessages(
        prompt.template_format,
        formattedMessages,
        variables
      );
    }

    const messages = formattedMessages.map((message) => {
      const openAIMessage = safelyConvertMessageToProvider({
        message,
        targetProvider: "OPENAI",
      });
      invariant(openAIMessage, "Message is not valid");
      return openAIMessage;
    });

    // Raw tools are trusted to already match the OpenAI SDK shape.
    const tools = getOpenAITools(prompt);

    const tool_choice: OpenaiToolChoice | undefined = tools
      ? (safelyConvertToolChoiceToProvider({
          toolChoice: prompt?.tools?.tool_choice,
          targetProvider: "OPENAI",
        }) ?? undefined)
      : undefined;

    const response_format = prompt.response_format
      ? phoenixResponseFormatToOpenAI.parse(prompt.response_format)
      : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools,
      tool_choice,
      response_format,
    } satisfies Partial<ChatCompletionCreateParams>;

    return completionParams;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to convert prompt to OpenAI params`);
    // eslint-disable-next-line no-console
    console.error(e);
    return null;
  }
};
