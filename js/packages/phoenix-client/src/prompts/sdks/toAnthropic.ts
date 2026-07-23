import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/messages/messages";
import invariant from "tiny-invariant";

import type { AnthropicToolChoice } from "../../schemas/llm/anthropic/toolChoiceSchemas";
import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
  safelyConvertToolDefinitionToProvider,
} from "../../schemas/llm/converters";
import { isPromptToolRaw } from "../../types/prompts";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import type { toSDKParamsBase, Variables } from "./types";

// We must re-export these types so that they are included in the phoenix-client distribution
export type { MessageCreateParams };

export type ToAnthropicParams<PromptVariables extends Variables> =
  toSDKParamsBase<PromptVariables>;

/**
 * Convert a Phoenix prompt to Anthropic client sdk's message create parameters
 */
export const toAnthropic = <PromptVariables extends Variables = Variables>({
  prompt,
  variables,
}: ToAnthropicParams<PromptVariables>): MessageCreateParams | null => {
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

    const toolsList = prompt.tools?.tools ?? [];
    // Cast: raw tools are `Record<string, unknown>` straight from the prompt
    // store. We trust the upstream caller to have stored a shape Anthropic's
    // SDK accepts; no validation here.
    const tools =
      toolsList.length === 0
        ? undefined
        : // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- raw tools are trusted to match Anthropic's SDK shape; no validation here
          (toolsList.map((tool) => {
            if (isPromptToolRaw(tool)) {
              return tool.raw;
            }
            const anthropicToolDefinition =
              safelyConvertToolDefinitionToProvider({
                toolDefinition: tool,
                targetProvider: "ANTHROPIC",
              });
            invariant(anthropicToolDefinition, "Tool definition is not valid");
            return anthropicToolDefinition;
          }) as MessageCreateParams["tools"]);

    const tool_choice: AnthropicToolChoice | undefined = tools
      ? (safelyConvertToolChoiceToProvider({
          toolChoice: prompt?.tools?.tool_choice,
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
