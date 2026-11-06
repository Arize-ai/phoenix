import type {
  Tool as AnthropicTool,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { faker } from "@faker-js/faker";
import { generate as jsfGenerate } from "json-schema-faker";
import type { JsonSchema } from "json-schema-faker";
import type {
  ChatCompletionTool,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";

import type { JSONSchema } from "./types.js";

const defaultOptions = {
  alwaysFakeOptionals: true,
  useDefaultValue: true,
  minItems: 1,
  maxItems: 3,
  minLength: 1,
  maxLength: 20,
  resolveJsonPath: true,
  useExamplesValue: true,
  failOnInvalidTypes: false,
  extensions: { faker },
} as const;

/**
 * Generate a unique ID for OpenAI tool calls
 */
export function generateToolCallId(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "call_";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate a unique ID for Anthropic tool use blocks
 * Anthropic uses format: toolu_01XXXXXXXXXXXXXXXXXXXXXX
 */
export function generateAnthropicToolUseId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "toolu_01";
  for (let i = 0; i < 22; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate a message ID for Anthropic messages
 * Anthropic uses format: msg_01XXXXXXXXXXXXXXXXXXXXXX
 */
export function generateAnthropicMessageId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "msg_01";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate a chat completion ID
 */
export function generateCompletionId(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "chatcmpl-";
  for (let i = 0; i < 29; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate fake data based on JSON Schema using json-schema-faker
 *
 * Supports:
 * - All JSON Schema types (string, number, integer, boolean, array, object, null)
 * - Enums, const, default values
 * - String formats (email, uri, date-time, uuid, ipv4, hostname, etc.)
 * - String patterns (regex)
 * - Number constraints (minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf)
 * - String constraints (minLength, maxLength, pattern)
 * - Array constraints (minItems, maxItems, uniqueItems)
 * - Object constraints (required, additionalProperties, minProperties, maxProperties)
 * - Schema composition (oneOf, anyOf, allOf)
 * - $ref references
 * - Faker.js integration for realistic data based on property names
 */
export async function generateFakeData(
  schema: JSONSchema | undefined
): Promise<unknown> {
  if (!schema) {
    return {};
  }

  try {
    const normalizedSchema = normalizeSchemaTypes(schema);
    return await jsfGenerate(normalizedSchema as JsonSchema, {
      ...defaultOptions,
    });
  } catch (error) {
    console.warn("Failed to generate fake data from schema:", error);
    return {};
  }
}

/**
 * Normalize schema types to lowercase (handles Gemini's uppercase types)
 */
function normalizeSchemaTypes(schema: JSONSchema): JSONSchema {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const normalized: JSONSchema = { ...schema };

  // Normalize type to lowercase
  if (typeof normalized.type === "string") {
    normalized.type = normalized.type.toLowerCase();
  }

  // Recursively normalize properties
  if (normalized.properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(normalized.properties).map(([key, value]) => [
        key,
        normalizeSchemaTypes(value),
      ])
    );
  }

  // Recursively normalize items
  if (normalized.items) {
    normalized.items = normalizeSchemaTypes(normalized.items);
  }

  return normalized;
}

/**
 * Generate a fake tool call based on the provided OpenAI tools (function tools only).
 */
export async function generateToolCall(
  tools: ChatCompletionTool[]
): Promise<ChatCompletionMessageToolCall | null> {
  const functionTools = tools.filter(
    (
      t
    ): t is typeof t & {
      function: { name: string; parameters?: unknown };
    } => "function" in t && t.function != null
  );
  if (functionTools.length === 0) {
    return null;
  }

  const tool = functionTools[Math.floor(Math.random() * functionTools.length)];
  const args = await generateFakeData(tool.function.parameters as JSONSchema);

  return {
    id: generateToolCallId(),
    type: "function",
    function: {
      name: tool.function.name,
      arguments: JSON.stringify(args),
    },
  };
}

/**
 * Generate multiple OpenAI tool calls
 */
export async function generateToolCalls(
  tools: ChatCompletionTool[],
  count: number = 1
): Promise<ChatCompletionMessageToolCall[]> {
  const calls: ChatCompletionMessageToolCall[] = [];
  for (let i = 0; i < count; i++) {
    const call = await generateToolCall(tools);
    if (call) {
      calls.push(call);
    }
  }
  return calls;
}

/**
 * Generate a fake Anthropic tool use block based on the provided tools (SDK types)
 */
export async function generateAnthropicToolUseFromSdk(
  tools: AnthropicTool[]
): Promise<ToolUseBlock | null> {
  if (tools.length === 0) {
    return null;
  }

  const tool = tools[Math.floor(Math.random() * tools.length)];
  const input = (await generateFakeData(
    tool.input_schema as JSONSchema
  )) as Record<string, unknown>;

  return {
    type: "tool_use",
    id: generateAnthropicToolUseId(),
    name: tool.name,
    input,
    caller: "user",
  } as unknown as ToolUseBlock;
}
