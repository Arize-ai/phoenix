import {
  openAIMessageToAI,
  promptMessageToOpenAI,
} from "../../schemas/llm/messageSchemas";
import {
  openAIToolChoiceToVercelToolChoice,
  phoenixToolChoiceToOpenaiToolChoice,
} from "../../schemas/llm/toolChoiceSchemas";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import { Variables, toSDKParamsBase } from "./types";
import type { streamText, generateText, ToolSet, Tool } from "ai";

export type PartialStreamTextParams = Omit<
  Parameters<typeof streamText>[0] | Parameters<typeof generateText>[0],
  "model"
>;

export type ToAIParams<V extends Variables> = toSDKParamsBase<V>;

/**
 * @todo
 */
export const toAI = <V extends Variables>({
  prompt,
  variables,
}: ToAIParams<V>): PartialStreamTextParams | null => {
  try {
    // parts of the prompt that can be directly converted to OpenAI params
    const baseCompletionParams = {
      // Invocation parameters are validated on the phoenix-side
      ...prompt.invocation_parameters,
    } satisfies Partial<PartialStreamTextParams>;

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

    const messages = formattedMessages.map((message) =>
      openAIMessageToAI.parse(promptMessageToOpenAI.parse(message))
    );

    let tools: ToolSet | undefined = prompt.tools?.tools.reduce((acc, tool) => {
      acc[tool.name] = {
        parameters: tool.schema?.json,
        description: tool.description,
      } satisfies Tool;
      return acc;
    }, {} as ToolSet);
    const hasTools = Object.keys(tools ?? {}).length > 0;
    tools = hasTools ? tools : undefined;

    // const response_format = prompt.response_format
    //   ? phoenixResponseFormatToOpenAI.parse(prompt.response_format)
    //   : undefined;

    const toolChoice =
      hasTools && prompt.tools?.tool_choice
        ? openAIToolChoiceToVercelToolChoice.parse(
            phoenixToolChoiceToOpenaiToolChoice.parse(prompt.tools?.tool_choice)
          )
        : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools,
      toolChoice,
      // response_format,
    } satisfies Partial<PartialStreamTextParams>;

    return completionParams;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to convert prompt to Anthropic params`);
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
};
