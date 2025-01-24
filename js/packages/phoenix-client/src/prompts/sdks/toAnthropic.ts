import type {
  MessageCreateParams,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { toSDKParamsBase } from "./types";
import { promptMessageToAnthropic } from "../../schemas/llm/messageSchemas";
import { promptMessageFormatter } from "../../utils/promptMessageFormatter";
import {
  AnthropicToolChoice,
  safelyConvertToolChoiceToProvider,
} from "../../schemas/llm/toolChoiceSchemas";
import {
  fromOpenAIToolDefinition,
  toOpenAIToolDefinition,
} from "../../schemas/llm/toolSchemas";
import invariant from "tiny-invariant";

export type { MessageCreateParams };

export type ToAnthropicParams = toSDKParamsBase;

export const toAnthropic = ({
  prompt,
  variables,
}: ToAnthropicParams): MessageCreateParams | null => {
  try {
    const { tool_choice: initialToolChoice, ...invocationParameters } =
      prompt.invocation_parameters as unknown as Record<string, unknown> & {
        tool_choice?: AnthropicToolChoice;
        max_tokens: number;
      };
    // parts of the prompt that can be directly converted to Anthropic params
    const baseCompletionParams = {
      model: prompt.model_name,
      ...invocationParameters,
    } satisfies Partial<MessageCreateParams>;

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
      promptMessageToAnthropic.parse(message)
    ) as MessageParam[];

    const tools = prompt.tools?.tool_definitions.map((tool) => {
      const openaiDefinition = toOpenAIToolDefinition(tool.definition);
      invariant(openaiDefinition, "Tool definition is not valid");
      return fromOpenAIToolDefinition({
        toolDefinition: openaiDefinition,
        targetProvider: "ANTHROPIC",
      });
    });

    const tool_choice = initialToolChoice
      ? (safelyConvertToolChoiceToProvider({
          toolChoice: initialToolChoice,
          targetProvider: "ANTHROPIC",
        }) ?? undefined)
      : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools: (tools?.length ?? 0) > 0 ? tools : undefined,
      tool_choice,
    } satisfies Partial<MessageCreateParams>;

    return completionParams;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to convert prompt to Anthropic params`);
    // eslint-disable-next-line no-console
    console.error(e);
    return null;
  }
};
