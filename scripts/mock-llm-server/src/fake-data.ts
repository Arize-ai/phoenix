import type { ChatCompletionTool, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type { Tool as AnthropicTool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import type { JSONSchema } from "./types.js";
import { JSONSchemaFaker } from "json-schema-faker";
import { faker } from "@faker-js/faker";

// Configure json-schema-faker to use faker.js for realistic data
JSONSchemaFaker.extend("faker", () => faker);

// Configure options for better output
JSONSchemaFaker.option({
  // Always fill optional properties for more complete responses
  alwaysFakeOptionals: true,
  // Use default values when provided
  useDefaultValue: true,
  // Generate minimum items for arrays (more predictable)
  minItems: 1,
  maxItems: 3,
  // Generate minimum properties for objects
  minLength: 1,
  maxLength: 20,
  // Resolve $ref references
  resolveJsonPath: true,
  // Use examples when provided
  useExamplesValue: true,
  // Fail silently on invalid schemas
  failOnInvalidTypes: false,
  failOnInvalidFormat: false,
});

/**
 * Generate a unique ID for OpenAI tool calls
 */
export function generateToolCallId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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
export function generateFakeData(schema: JSONSchema | undefined): unknown {
  if (!schema) {
    return {};
  }

  try {
    // Normalize schema type to lowercase (Gemini sends uppercase like "STRING", "OBJECT")
    const normalizedSchema = normalizeSchemaTypes(schema);
    return JSONSchemaFaker.generate(normalizedSchema as Parameters<typeof JSONSchemaFaker.generate>[0]);
  } catch (error) {
    // Fallback to empty object if schema is invalid
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
 * Generate a fake tool call based on the provided OpenAI tools
 */
export function generateToolCall(tools: ChatCompletionTool[]): ChatCompletionMessageToolCall | null {
  if (tools.length === 0) {
    return null;
  }

  // Pick a random tool
  const tool = tools[Math.floor(Math.random() * tools.length)];
  const args = generateFakeData(tool.function.parameters as JSONSchema);

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
export function generateToolCalls(
  tools: ChatCompletionTool[],
  count: number = 1
): ChatCompletionMessageToolCall[] {
  const calls: ChatCompletionMessageToolCall[] = [];
  for (let i = 0; i < count; i++) {
    const call = generateToolCall(tools);
    if (call) {
      calls.push(call);
    }
  }
  return calls;
}

/**
 * Generate a fake Anthropic tool use block based on the provided tools (SDK types)
 */
export function generateAnthropicToolUseFromSdk(tools: AnthropicTool[]): ToolUseBlock | null {
  if (tools.length === 0) {
    return null;
  }

  // Pick a random tool
  const tool = tools[Math.floor(Math.random() * tools.length)];
  const input = generateFakeData(tool.input_schema as JSONSchema) as Record<string, unknown>;

  return {
    type: "tool_use",
    id: generateAnthropicToolUseId(),
    name: tool.name,
    input,
  };
}
