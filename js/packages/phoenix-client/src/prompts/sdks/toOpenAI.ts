import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
  safelyConvertToolDefinitionToProvider,
} from "../../schemas/llm/converters";
import { OpenaiToolChoice } from "../../schemas/llm/openai/toolChoiceSchemas";
import { phoenixResponseFormatToOpenAI } from "../../schemas/llm/phoenixPrompt/converters";
import { formatPromptMessages } from "../../utils/formatPromptMessages";

import type { toSDKParamsBase,Variables } from "./types";

import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
} from "openai/resources";
import invariant from "tiny-invariant";

// We must re-export these types so that they are included in the phoenix-client distribution
export type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
};

export type ToOpenAIParams<V extends Variables> = toSDKParamsBase<V>;

/**
 * Convert a Phoenix prompt to OpenAI client sdk's chat completion parameters
 *
 * @returns The converted chat completion parameters
 */
export const toOpenAI = <V extends Variables = Variables>({
  prompt,
  variables,
}: ToOpenAIParams<V>): ChatCompletionCreateParams | null => {
  try {
    let invocationParameters: Partial<ChatCompletionCreateParams>;
    if (prompt.invocation_parameters.type === "openai") {
      invocationParameters = prompt.invocation_parameters.openai;
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "Prompt is not an OpenAI prompt, falling back to default OpenAI invocation parameters"
      );
      invocationParameters = {};
    }
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

    let tools = prompt.tools?.tools.map((tool) => {
      const openAIToolDefinition = safelyConvertToolDefinitionToProvider({
        toolDefinition: tool,
        targetProvider: "OPENAI",
      });
      invariant(openAIToolDefinition, "Tool definition is not valid");
      return openAIToolDefinition;
    });
    tools = (tools?.length ?? 0) > 0 ? tools : undefined;

    let tool_choice: OpenaiToolChoice | undefined =
      safelyConvertToolChoiceToProvider({
        toolChoice: prompt?.tools?.tool_choice,
        targetProvider: "OPENAI",
      }) || undefined;
    tool_choice = tools?.length ? tool_choice : undefined;

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
