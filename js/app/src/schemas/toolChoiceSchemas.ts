import { z } from "zod";

/**
 * OpenAI's tool choice schema
 *
 * Covers all current ChatCompletionToolChoiceOptionParam variants:
 * - string literals "none" | "auto" | "required"
 * - { type: "function", function: { name } }  — force a specific function
 * - { type: "allowed_tools", allowed_tools: { mode, tools } } — constrain to subset
 * - { type: "custom", custom: { name } } — force a custom tool
 *
 * @see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
 */
export const openAIToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("none"),
  z.literal("required"),
  z.object({
    type: z.literal("function"),
    function: z.object({ name: z.string() }),
  }),
  z.object({
    type: z.literal("allowed_tools"),
    allowed_tools: z.object({
      mode: z.enum(["auto", "required"]),
      tools: z.array(z.object({ type: z.string() }).passthrough()).optional(),
    }),
  }),
  z.object({
    type: z.literal("custom"),
    custom: z.object({ name: z.string() }),
  }),
]);

export type OpenaiToolChoice = z.infer<typeof openAIToolChoiceSchema>;

/**
 * AWS Bedrock Converse API tool choice schema.
 *
 * ToolChoice is a union: exactly one of auto, any, or tool.
 * Specific tool is { tool: { name: string } }, not { type: "tool", name }.
 *
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_SpecificToolChoice.html
 */
export const awsToolChoiceSchema = z.union([
  z.object({ auto: z.object({}) }),
  z.object({ any: z.object({}) }),
  z.object({ tool: z.object({ name: z.string() }) }),
]);

export type AwsToolChoice = z.infer<typeof awsToolChoiceSchema>;

/**
 * Anthropic's tool choice schema
 *
 * @see https://docs.anthropic.com/en/api/messages
 */
export const anthropicToolChoiceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("auto"),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("any"),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("tool"),
    name: z.string(),
    disable_parallel_tool_use: z.boolean().optional(),
  }),
]);

export type AnthropicToolChoice = z.infer<typeof anthropicToolChoiceSchema>;

/**
 * Google's tool choice schema (ToolConfig / FunctionCallingConfig)
 *
 * mode is case-insensitive: the Python SDK uses uppercase ("AUTO", "ANY", "NONE",
 * "VALIDATED", "MODE_UNSPECIFIED") but Phoenix-generated spans emit lowercase.
 * We normalize to lowercase during parsing.
 *
 * @see https://github.com/googleapis/python-genai/blob/main/google/genai/types.py
 */
export const googleToolChoiceSchema = z.object({
  function_calling_config: z.object({
    mode: z.preprocess(
      (v) => (typeof v === "string" ? v.toLowerCase() : v),
      z.enum(["auto", "any", "none", "validated", "mode_unspecified"])
    ),
    allowed_function_names: z.array(z.string()).optional(),
    stream_function_call_arguments: z.boolean().optional(),
  }),
});

export type GoogleToolChoice = z.infer<typeof googleToolChoiceSchema>;

/**
 * Schemas that extract the raw tool-choice value from provider-specific
 * invocation_parameters. Try in order: tool_choice (OpenAI/Anthropic),
 * tool_config (Google), toolConfig.toolChoice (AWS).
 */
const invocationParamsWithToolChoiceOpenAISchema = z
  .object({ tool_choice: z.unknown() })
  .transform((o) => o.tool_choice);

const invocationParamsWithToolChoiceGoogleSchema = z
  .object({ tool_config: z.unknown() })
  .transform((o) => o.tool_config);

const invocationParamsWithToolChoiceAWSSchema = z
  .object({
    toolConfig: z.object({ toolChoice: z.unknown() }),
  })
  .transform((o) => o.toolConfig.toolChoice);

/**
 * Parses invocation_parameters (object) and returns the raw tool-choice value
 * for use with openAIToolChoiceSchema / anthropicToolChoiceSchema /
 * googleToolChoiceSchema / awsToolChoiceSchema. Returns undefined if no
 * provider-specific tool choice key is present.
 */
export const rawToolChoiceFromInvocationParametersSchema = z
  .record(z.string(), z.unknown())
  .transform((invParams): unknown => {
    const openAI =
      invocationParamsWithToolChoiceOpenAISchema.safeParse(invParams);
    if (openAI.success && openAI.data !== undefined) return openAI.data;
    const google =
      invocationParamsWithToolChoiceGoogleSchema.safeParse(invParams);
    if (google.success && google.data !== undefined) return google.data;
    const aws = invocationParamsWithToolChoiceAWSSchema.safeParse(invParams);
    if (aws.success && aws.data !== undefined) return aws.data;
    return undefined;
  });
