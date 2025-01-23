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

export type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ResponseFormatJSONSchema,
};

export type ToOpenAIParams = toSDKParamsBase;

export const toOpenAI = ({
  prompt,
}: ToOpenAIParams): ChatCompletionCreateParams | null => {
  try {
    // parts of the prompt that can be directly converted to OpenAI params
    const baseCompletionParams = {
      model: prompt.model_name,
      // TODO: Do we need to map over the invocation_parameters? Probably.
      ...prompt.invocation_parameters,
    } satisfies Partial<ChatCompletionCreateParams>;

    if (!("messages" in prompt.template)) {
      return null;
    }

    const messages = prompt.template.messages.map((message) =>
      promptMessageToOpenAI.parse(message)
    ) as ChatCompletionMessageParam[];

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
