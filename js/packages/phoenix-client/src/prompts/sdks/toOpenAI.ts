import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
} from "openai/resources";
import type { Variables, toSDKParamsBase } from "./types";
import {
  phoenixToolToOpenAI,
  promptMessageToOpenAI,
  safelyConvertToolChoiceToProvider,
} from "../../schemas/llm";
import { promptMessageFormatter } from "../../utils/promptMessageFormatter";
import { phoenixResponseFormatToOpenAI } from "../../schemas/llm/responseFormatSchema";

// We must re-export these types so that they are included in the phoenix-client distribution
export type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
};

export type ToOpenAIParams<V extends Variables> = toSDKParamsBase<V>;

/**
 * Convert a Phoenix prompt to OpenAI client sdk parameters
 */
export const toOpenAI = <V extends Variables = Variables>({
  prompt,
  variables,
}: ToOpenAIParams<V>): ChatCompletionCreateParams | null => {
  try {
    // parts of the prompt that can be directly converted to OpenAI params
    const baseCompletionParams = {
      model: prompt.model_name,
      // Invocation parameters are validated on the phoenix-side
      ...prompt.invocation_parameters,
    } satisfies Partial<ChatCompletionCreateParams>;

    if (!("messages" in prompt.template)) {
      return null;
    }

    let formattedMessages = prompt.template.messages;

    if (variables) {
      formattedMessages = promptMessageFormatter(
        prompt.template_format,
        formattedMessages,
        variables
      );
    }

    const messages = formattedMessages.map((message) =>
      promptMessageToOpenAI.parse(message)
    );

    const tools = prompt.tools?.tools.map((tool) =>
      phoenixToolToOpenAI.parse(tool)
    );

    const response_format = prompt.response_format
      ? phoenixResponseFormatToOpenAI.parse(prompt.response_format)
      : undefined;

    const tool_choice =
      (tools?.length ?? 0) > 0 && "tool_choice" in baseCompletionParams
        ? (safelyConvertToolChoiceToProvider({
            toolChoice: baseCompletionParams.tool_choice,
            targetProvider: "OPENAI",
          }) ?? undefined)
        : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools: (tools?.length ?? 0) > 0 ? tools : undefined,
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
