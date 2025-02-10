import invariant from "tiny-invariant";
import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
} from "../../schemas/llm/converters";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import { Variables, toSDKParamsBase } from "./types";
import {
  type streamText,
  type generateText,
  type ToolSet,
  type Tool,
  jsonSchema,
} from "ai";
import { VercelAIToolChoice } from "../../schemas/llm/ai/toolChoiceSchemas";

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
      if (!tool.schema?.json) {
        return acc;
      }
      acc[tool.name] = {
        type: "function",
        parameters: jsonSchema(tool.schema.json),
        description: tool.description,
      } satisfies Tool;
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
