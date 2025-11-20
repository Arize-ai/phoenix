import { jsonLiteralSchema } from "../../jsonLiteralSchema";

import z from "zod";

/**
 * The schema for an Anthropic tool call, this is what a message that calls a tool looks like
 */
export const anthropicToolCallSchema = z.object({
  id: z.string().describe("The ID of the tool call"),
  type: z.literal("tool_use"),
  name: z.string().describe("The name of the tool"),
  input: jsonLiteralSchema.describe("The input for the tool"),
});

/**
 * The type of an Anthropic tool call
 */
export type AnthropicToolCall = z.infer<typeof anthropicToolCallSchema>;

/**
 * The zod schema for multiple Anthropic tool calls
 */
export const anthropicToolCallsSchema = z.array(anthropicToolCallSchema);

/**
 * Creates an empty Anthropic tool call with fields but no values filled in
 */
export function createAnthropicToolCall(): AnthropicToolCall {
  return {
    id: "",
    type: "tool_use",
    name: "",
    input: {},
  };
}
