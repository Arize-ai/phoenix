import { AnthropicToolChoice } from "../../schemas/llm/anthropic/toolChoiceSchemas";
import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
  safelyConvertToolDefinitionToProvider,
} from "../../schemas/llm/converters";
import { formatPromptMessages } from "../../utils/formatPromptMessages";

import type { toSDKParamsBase, Variables } from "./types";

import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/messages/messages";
import invariant from "tiny-invariant";

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
    let invocationParameters: { max_tokens: number } | undefined;
    if (prompt.invocation_parameters.type === "anthropic") {
      invocationParameters = prompt.invocation_parameters.anthropic;
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "Prompt is not an Anthropic prompt, falling back to default Anthropic invocation parameters"
      );
      invocationParameters = { max_tokens: 1024 };
    }
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

    const messages = formattedMessages.map((message) => {
      const anthropicMessage = safelyConvertMessageToProvider({
        message,
        targetProvider: "ANTHROPIC",
      });
      invariant(anthropicMessage, "Message is not valid");
      return anthropicMessage;
    });

    let tools = prompt.tools?.tools.map((tool) => {
      const anthropicToolDefinition = safelyConvertToolDefinitionToProvider({
        toolDefinition: tool,
        targetProvider: "ANTHROPIC",
      });
      invariant(anthropicToolDefinition, "Tool definition is not valid");
      return anthropicToolDefinition;
    });
    tools = (tools?.length ?? 0) > 0 ? tools : undefined;

    let tool_choice: AnthropicToolChoice | undefined =
      safelyConvertToolChoiceToProvider({
        toolChoice: prompt?.tools?.tool_choice,
        targetProvider: "ANTHROPIC",
      }) || undefined;
    tool_choice = tools?.length ? tool_choice : undefined;

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
