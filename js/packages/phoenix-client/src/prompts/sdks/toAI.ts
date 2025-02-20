import invariant from "tiny-invariant";
import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
  safelyConvertToolDefinitionToProvider,
} from "../../schemas/llm/converters";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import { Variables, toSDKParamsBase } from "./types";
import {
  type streamText,
  type generateText,
  type ToolSet,
  type Tool,
} from "ai";
import { VercelAIToolChoice } from "../../schemas/llm/vercel/toolChoiceSchemas";

export type PartialStreamTextParams = Omit<
  Parameters<typeof streamText>[0] | Parameters<typeof generateText>[0],
  "model"
>;

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
}: ToAIParams<V>): PartialStreamTextParams | null => {
  // eslint-disable-next-line no-console
  console.warn(
    "Prompt invocation parameters not currently supported in AI SDK, falling back to default invocation parameters"
  );
  try {
    // parts of the prompt that can be directly converted to OpenAI params
    const baseCompletionParams = {
      // Invocation parameters are validated on the phoenix-side
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

    const messages = formattedMessages.map((message) => {
      const vercelAIMessage = safelyConvertMessageToProvider({
        message,
        targetProvider: "VERCEL_AI",
      });
      invariant(vercelAIMessage, "Message is not valid");
      return vercelAIMessage;
    });

    // convert tools to Vercel AI tool set, which is a map of tool name to tool
    let tools: ToolSet | undefined = prompt.tools?.tools.reduce((acc, tool) => {
      if (!tool.function.parameters) {
        return acc;
      }
      const vercelAIToolDefinition = safelyConvertToolDefinitionToProvider({
        toolDefinition: tool,
        targetProvider: "VERCEL_AI",
      });
      invariant(vercelAIToolDefinition, "Tool definition is not valid");
      acc[tool.function.name] = vercelAIToolDefinition satisfies Tool;
      return acc;
    }, {} as ToolSet);
    const hasTools = Object.keys(tools ?? {}).length > 0;
    tools = hasTools ? tools : undefined;

    let toolChoice: VercelAIToolChoice | undefined =
      safelyConvertToolChoiceToProvider({
        toolChoice: prompt.tools?.tool_choice,
        targetProvider: "VERCEL_AI",
      }) || undefined;
    toolChoice = hasTools ? toolChoice : undefined;

    // combine base and computed params
    const completionParams = {
      ...baseCompletionParams,
      messages,
      tools,
      toolChoice,
    } satisfies Partial<PartialStreamTextParams>;

    return completionParams;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to convert prompt to AI params`);
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
};
