import type { ModelMessage, ToolChoice, ToolSet } from "ai" with {
  "resolution-mode": "import",
};
import invariant from "tiny-invariant";

import {
  safelyConvertMessageToProvider,
  safelyConvertToolChoiceToProvider,
  safelyConvertToolDefinitionToProvider,
} from "../../schemas/llm/converters";
import { findToolDefinitionName } from "../../schemas/llm/utils";
import type { PromptToolRaw } from "../../types/prompts";
import { isPromptToolRaw } from "../../types/prompts";
import { formatPromptMessages } from "../../utils/formatPromptMessages";
import type { Variables, toSDKParamsBase } from "./types";

/**
 * Best-effort name for a vendor-passthrough (raw) tool. Vercel AI SDK keys its
 * `tools` record by tool name, so we need a stable string identifier even when
 * the raw payload doesn't carry a conventional `name` field — fall back to
 * `type` (e.g. "web_search") which the Responses-style SDKs use as the key.
 */
const getRawToolName = (tool: PromptToolRaw): string | null => {
  if (typeof tool.raw.name === "string") {
    return tool.raw.name;
  }
  if (typeof tool.raw.type === "string") {
    return tool.raw.type;
  }
  return null;
};

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

export type ToAIParams<PromptVariables extends Variables> =
  toSDKParamsBase<PromptVariables>;

/**
 * Converts a Phoenix prompt to Vercel AI sdk params.
 *
 * - note: To use response format, you must pass `prompt.response_format.json_schema.schema` to generateObject or streamObject
 *   via `jsonSchema()`, through the `schema` argument.
 */
export const toAI = <PromptVariables extends Variables>({
  prompt,
  variables,
}: ToAIParams<PromptVariables>): PartialAIParams | null => {
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

    const toolsList = prompt.tools?.tools ?? [];
    let tools: ToolSet | undefined;
    if (toolsList.length > 0) {
      const toolsRecord: Record<string, unknown> = {};
      for (const tool of toolsList) {
        const name = isPromptToolRaw(tool)
          ? getRawToolName(tool)
          : findToolDefinitionName(tool);
        invariant(name, "Tool definition name is not valid");
        const converted = isPromptToolRaw(tool)
          ? tool.raw
          : safelyConvertToolDefinitionToProvider({
              toolDefinition: tool,
              targetProvider: "VERCEL_AI",
            });
        invariant(converted, "Tool definition is not valid");
        toolsRecord[name] = converted;
      }
      if (Object.keys(toolsRecord).length > 0) {
        tools = toolsRecord as ToolSet;
      }
    }

    let toolChoice: PartialAIParams["toolChoice"];
    if (tools && prompt.tools?.tool_choice) {
      toolChoice =
        safelyConvertToolChoiceToProvider({
          toolChoice: prompt.tools.tool_choice,
          targetProvider: "VERCEL_AI",
        }) ?? undefined;
    }

    // combine base and computed params
    const completionParams: PartialAIParams = {
      ...baseCompletionParams,
      messages,
      ...(tools !== undefined && { tools }),
      ...(toolChoice !== undefined && { toolChoice }),
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
