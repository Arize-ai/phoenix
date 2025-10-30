import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
} from "../../schemas/llm/converters";
import { VercelAIToolChoice } from "../../schemas/llm/vercel/toolChoiceSchemas";
import { formatPromptMessages } from "../../utils/formatPromptMessages";

import { toSDKParamsBase, Variables } from "./types";

import { type ModelMessage, type ToolChoice, type ToolSet } from "ai";
import invariant from "tiny-invariant";

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
 * - note: To use response format, you must pass `prompt.response_format.json` to generateObject or streamObject
 *   directly, through the `schema` argument.
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

    // convert tools to Vercel AI tool set, which is a map of tool name to tool
    // TODO: Vercel AI SDK 5 has complex tool schema
    // let tools: ToolSet | undefined = prompt.tools?.tools.reduce((acc, tool) => {
    //   if (!tool.function.parameters) {
    //     return acc;
    //   }
    //   const vercelAIToolDefinition = safelyConvertToolDefinitionToProvider({
    //     toolDefinition: tool,
    //     targetProvider: "VERCEL_AI",
    //   });
    //   invariant(vercelAIToolDefinition, "Tool definition is not valid");
    //   // TODO: get the symbol working here for validators
    //   acc[tool.function.name] = vercelAIToolDefinition as unknown as Tool;
    //   return acc;
    // }, {} as ToolSet);
    // const hasTools = Object.keys(tools ?? {}).length > 0;
    // tools = hasTools ? tools : undefined;
    const hasTools = false;
    const tools = undefined;
    if (prompt.tools?.tools && prompt.tools?.tools.length) {
      // eslint-disable-next-line no-console
      console.warn(
        "Prompt tools not currently supported in the AI SDK, falling back to no tools"
      );
    }
    let toolChoice: VercelAIToolChoice | undefined =
      safelyConvertToolChoiceToProvider({
        toolChoice: prompt.tools?.tool_choice,
        targetProvider: "VERCEL_AI",
      }) || undefined;
    toolChoice = hasTools ? toolChoice : undefined;

    // combine base and computed params
    const completionParams: PartialAIParams = {
      ...baseCompletionParams,
      messages,
      tools,
      toolChoice,
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
