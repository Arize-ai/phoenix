import { type ModelMessage, type ToolChoice, type ToolSet } from "ai";
import invariant from "tiny-invariant";

import {
  safelyConvertMessageToProvider
} from "../../schemas/llm/converters";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import { Variables, toSDKParamsBase } from "./types";

export type PartialAIParams = {
  messages: ModelMessage[];
  /**
The tools that the model can call. The model needs to support calling tools.
    */
  tools?: ToolSet;
  /**
The tool choice strategy. Default: 'auto'.
     */
  toolChoice?: ToolChoice<ToolSet>;
};

export type ToAIParams<V extends Variables> = toSDKParamsBase<V>;

/**
 * Converts a Phoenix prompt to Vercel AI sdk params.
 *
 * - note: To use response format, you must pass `prompt.response_format.json_schema.schema` to generateObject or streamObject
 *   via `jsonSchema()`, through the `schema` argument.
 */
export const toAI = <V extends Variables>({
  prompt,
  variables,
}: ToAIParams<V>): PartialAIParams | null => {
  // eslint-disable-next-line no-console
  console.warn(
    "Prompt invocation parameters not currently supported in AI SDK, falling back to default invocation parameters"
  );
  try {
    // parts of the prompt that can be directly converted to OpenAI params
    const baseCompletionParams: Partial<PartialAIParams> = {
      // Invocation parameters are validated on the phoenix-side
    };

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

    const messages: ModelMessage[] = formattedMessages.map((message) => {
      const vercelAIMessage = safelyConvertMessageToProvider({
        message,
        targetProvider: "VERCEL_AI",
      });
      invariant(vercelAIMessage, "Message is not valid");
      return vercelAIMessage;
    });

    const tools = undefined;
    if (prompt.tools?.tools && prompt.tools?.tools.length) {
      // eslint-disable-next-line no-console
      console.warn(
        "Phoenix client does not automatically convert tools to AI SDK tools, please manually convert them."
      );
    }

    // combine base and computed params
    const completionParams: PartialAIParams = {
      ...baseCompletionParams,
      messages,
      tools,
    };

    return completionParams;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to convert prompt to AI params`);
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
};
