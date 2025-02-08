import z from "zod";
import { JSONLiteral, jsonLiteralSchema } from "../jsonLiteralSchema";
import { anthropicMessageSchema } from "./anthropic/messageSchemas";
import { openAIMessageSchema } from "./openai/messageSchemas";
import { promptMessageSchema } from "./phoenixPrompt/messageSchemas";
import { openAIToolCallSchema } from "./openai/toolCallSchemas";
import { anthropicToolCallSchema } from "./anthropic/toolCallSchemas";
import { openAIToolChoiceSchema } from "./openai/toolChoiceSchemas";
import { anthropicToolChoiceSchema } from "./anthropic/toolChoiceSchemas";
import {
  OpenAIToolDefinition,
  openAIToolDefinitionSchema,
} from "./openai/toolSchemas";
import {
  AnthropicToolDefinition,
  anthropicToolDefinitionSchema,
} from "./anthropic/toolSchemas";
import { PromptModelProvider } from "../../types/prompts";

/**
 * Union of all message formats
 */
export const llmProviderMessageSchema = z.union([
  openAIMessageSchema,
  anthropicMessageSchema,
  promptMessageSchema,
  jsonLiteralSchema,
]);

export type LlmProviderMessage = z.infer<typeof llmProviderMessageSchema>;

/**
 * Union of all tool call formats
 *
 * This is useful for functions that need to accept any tool call format
 */
export const llmProviderToolCallSchema = z.union([
  openAIToolCallSchema,
  anthropicToolCallSchema,
  jsonLiteralSchema,
]);

export type LlmProviderToolCall = z.infer<typeof llmProviderToolCallSchema>;

/**
 * A union of all the lists of tool call formats
 *
 * This is useful for parsing all of the tool calls in a message
 */
export const llmProviderToolCallsSchema = z.array(llmProviderToolCallSchema);

export type LlmProviderToolCalls = z.infer<typeof llmProviderToolCallsSchema>;

/**
 * A schema for a tool call that is not in the first class supported format
 *
 * This is used to heuristically find the id, name, and arguments of a tool call
 * based on common patterns in tool calls, allowing us to poke around in an unknown tool call
 * and extract the id, name, and arguments
 */
export const toolCallHeuristicSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export const llmProviderToolChoiceSchema = z.union([
  openAIToolChoiceSchema,
  anthropicToolChoiceSchema,
]);

export type LlmProviderToolChoice = z.infer<typeof llmProviderToolChoiceSchema>;

/**
 * Union of all tool call formats
 *
 * This is useful for functions that need to accept any tool definition format
 */
export const llmProviderToolDefinitionSchema = z.union([
  openAIToolDefinitionSchema,
  anthropicToolDefinitionSchema,
  jsonLiteralSchema,
]);

export type LlmProviderToolDefinition = z.infer<
  typeof llmProviderToolDefinitionSchema
>;

export type ToolDefinitionWithProvider =
  | {
      provider: Extract<PromptModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedToolDefinition: OpenAIToolDefinition;
    }
  | {
      provider: Extract<PromptModelProvider, "ANTHROPIC">;
      validatedToolDefinition: AnthropicToolDefinition;
    }
  | {
      provider: "UNKNOWN";
      validatedToolDefinition: null;
    };

export type ProviderToToolDefinitionMap = {
  OPENAI: OpenAIToolDefinition;
  AZURE_OPENAI: OpenAIToolDefinition;
  ANTHROPIC: AnthropicToolDefinition;
  // Use generic JSON type for unknown tool formats / new providers
  GEMINI: JSONLiteral;
};
