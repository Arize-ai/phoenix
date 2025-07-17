import z from "zod";

/**
 * The schema for an OpenAI tool call, this is what a message that calls a tool looks like
 *
 * Note: The nested passThrough's are used to allow for extra keys in JSON schema, however, they do not actually
 * allow for extra keys when the zod schema is used for parsing. This is to allow more flexibility for users
 * to define their own tool calls according
 */
export const openAIToolCallSchema = z.object({
  type: z
    .literal("function")
    .optional()
    .transform(() => "function" as const),
  id: z.string().describe("The ID of the tool call"),
  function: z
    .object({
      name: z.string().describe("The name of the function"),
      arguments: z.string().describe("The arguments for the function"),
    })
    .describe("The function that is being called")
    .passthrough(),
});

/**
 * The type of an OpenAI tool call
 *
 * @example
 * ```typescript
 *  {
 *   id: "1",
 *   function: {
 *     name: "getCurrentWeather",
 *     arguments: { "city": "San Francisco" }
 *   }
 * }
 * ```
 */
export type OpenAIToolCall = z.infer<typeof openAIToolCallSchema>;

/**
 * The zod schema for multiple OpenAI Tool Calls
 */
export const openAIToolCallsSchema = z.array(openAIToolCallSchema);

/**
 * Creates an empty OpenAI tool call with fields but no values filled in
 */
export function createOpenAIToolCall(): OpenAIToolCall {
  return {
    type: "function",
    id: "",
    function: {
      name: "",
      arguments: "{}",
    },
  };
}
