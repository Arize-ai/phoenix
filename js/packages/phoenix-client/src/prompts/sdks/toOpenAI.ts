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
    let invocationParameters: Partial<ChatCompletionCreateParams>;
    switch (prompt.invocation_parameters.type) {
      case "openai":
        invocationParameters = prompt.invocation_parameters.openai;
        break;
      case "azure_openai":
        invocationParameters = prompt.invocation_parameters.azure_openai;
        break;
      case "deepseek":
        invocationParameters = prompt.invocation_parameters.deepseek;
        break;
      case "xai":
        invocationParameters = prompt.invocation_parameters.xai;
        break;
      case "ollama":
        invocationParameters = prompt.invocation_parameters.ollama;
        break;
      case "cerebras":
        invocationParameters = prompt.invocation_parameters.cerebras;
        break;
      case "fireworks":
        invocationParameters = prompt.invocation_parameters.fireworks;
        break;
      case "groq":
        invocationParameters = prompt.invocation_parameters.groq;
        break;
      case "moonshot":
        invocationParameters = prompt.invocation_parameters.moonshot;
        break;
      case "perplexity":
        invocationParameters = prompt.invocation_parameters.perplexity;
        break;
      case "together":
        invocationParameters = prompt.invocation_parameters.together;
        break;
      default:
        // eslint-disable-next-line no-console
        console.warn(
          "Prompt is not an OpenAI-family prompt, falling back to default OpenAI invocation parameters"
        );
        invocationParameters = {};
        break;
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

    const toolsList = prompt.tools?.tools ?? [];
    // Cast: raw tools are `Record<string, unknown>` straight from the prompt
    // store. We trust the upstream caller to have stored a shape OpenAI's
    // SDK accepts; no validation here.
    const tools =
      toolsList.length === 0
        ? undefined
        : // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- raw tools are trusted to match OpenAI's SDK shape; no validation here
          (toolsList.map((tool) => {
            if (isPromptToolRaw(tool)) {
              return tool.raw;
            }
            const openAIToolDefinition = safelyConvertToolDefinitionToProvider({
              toolDefinition: tool,
              targetProvider: "OPENAI",
            });
            invariant(openAIToolDefinition, "Tool definition is not valid");
            return openAIToolDefinition;
          }) as unknown as ChatCompletionCreateParams["tools"]);

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
