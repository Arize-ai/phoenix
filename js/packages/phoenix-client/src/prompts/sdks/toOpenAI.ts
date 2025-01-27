import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletionToolChoiceOption,
  ResponseFormatJSONSchema,
} from "openai/resources";
import type { toSDKParamsBase } from "./types";
import {
  openAIToolDefinitionSchema,
  promptMessageToOpenAI,
} from "../../schemas/llm";
import { promptMessageFormatter } from "../../utils/promptMessageFormatter";

// We must re-export these types so that they are included in the phoenix-client distribution
export type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
};

export type ToOpenAIParams = toSDKParamsBase;

export const toOpenAI = ({
  prompt,
  variables,
}: ToOpenAIParams): ChatCompletionCreateParams | null => {
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

    const tools = prompt.tools?.tool_definitions.map((tool) =>
      openAIToolDefinitionSchema.parse(tool.definition)
    );

    const response_format = prompt.output_schema?.definition
      ? // we validate this on the phoenix-side
        (prompt.output_schema
          ?.definition as unknown as ResponseFormatJSONSchema)
      : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools: (tools?.length ?? 0) > 0 ? tools : undefined,
      tool_choice:
        (tools?.length ?? 0) > 0 && "tool_choice" in baseCompletionParams
          ? // we validate this on the phoenix-side
            (baseCompletionParams.tool_choice as unknown as ChatCompletionToolChoiceOption)
          : undefined,
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
