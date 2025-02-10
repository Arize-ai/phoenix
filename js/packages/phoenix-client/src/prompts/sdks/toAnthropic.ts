import type {
  MessageCreateParams,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { Variables, toSDKParamsBase } from "./types";
import { formatPromptMessages } from "../../utils/formatPromptMessages";

import invariant from "tiny-invariant";
import {
  phoenixPromptToolChoiceToOpenAI,
  phoenixPromptToolDefinitionToOpenAI,
  phoenixPromptMessageToOpenAI,
} from "../../schemas/llm/phoenixPrompt/converters";
import { openAIMessageToAnthropic } from "../../schemas/llm/openai/converters";
import {
  fromOpenAIToolDefinition,
  safelyConvertToolChoiceToProvider,
} from "../../schemas/llm/converters";

// We must re-export these types so that they are included in the phoenix-client distribution
export type { MessageCreateParams };

export type ToAnthropicParams<V extends Variables> = toSDKParamsBase<V>;

/**
 * Convert a Phoenix prompt to Anthropic client sdk's message create parameters
 */
export const toAnthropic = <V extends Variables = Variables>({
  prompt,
  variables,
}: ToAnthropicParams<V>): MessageCreateParams | null => {
  try {
    const invocationParameters =
      prompt.invocation_parameters as unknown as Record<string, unknown> & {
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
      formattedMessages = formatPromptMessages(
        prompt.template_format,
        formattedMessages,
        variables
      );
    }

    const messages = formattedMessages.map((message) =>
      openAIMessageToAnthropic.parse(
        phoenixPromptMessageToOpenAI.parse(message)
      )
    ) as MessageParam[];

    let tools = prompt.tools?.tools.map((tool) => {
      const openaiDefinition = phoenixPromptToolDefinitionToOpenAI.parse(tool);
      invariant(openaiDefinition, "Tool definition is not valid");
      return fromOpenAIToolDefinition({
        toolDefinition: openaiDefinition,
        targetProvider: "ANTHROPIC",
      });
    });
    tools = (tools?.length ?? 0) > 0 ? tools : undefined;
    const tool_choice =
      (tools?.length ?? 0) > 0 && prompt.tools?.tool_choice
        ? (safelyConvertToolChoiceToProvider({
            toolChoice: phoenixPromptToolChoiceToOpenAI.parse(
              prompt.tools.tool_choice
            ),
            targetProvider: "ANTHROPIC",
          }) ?? undefined)
        : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools,
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
