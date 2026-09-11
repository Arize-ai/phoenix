import type { componentsV1 } from "@arizeai/phoenix-client";

export type OutputFormat = "pretty" | "json" | "raw" | "text";

type PromptVersion = componentsV1["schemas"]["PromptVersion"];
type PromptMessage = componentsV1["schemas"]["PromptMessage"];
type TextContentPart = componentsV1["schemas"]["TextContentPart"];
type ToolCallContentPart = componentsV1["schemas"]["ToolCallContentPart"];
type ToolResultContentPart = componentsV1["schemas"]["ToolResultContentPart"];

type ContentPart =
  | TextContentPart
  | ToolCallContentPart
  | ToolResultContentPart;

export interface FormatPromptOutputOptions {
  /**
   * Prompt version to format.
   */
  promptVersion: PromptVersion;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatPromptOutput({
  promptVersion,
  format,
}: FormatPromptOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(promptVersion);
  }
  if (selected === "json") {
    return JSON.stringify(promptVersion, null, 2);
  }
  if (selected === "text") {
    return formatPromptText(promptVersion);
  }
  return formatPromptPretty(promptVersion);
}

/**
 * Format a prompt version as plain text suitable for piping.
 * Chat templates are formatted with XML-style tags.
 * String templates return the raw template string.
 */
function formatPromptText(promptVersion: PromptVersion): string {
  const template = promptVersion.template;

  if (template.type === "string") {
    return template.template;
  }

  // Chat template - format with XML-style tags
  const lines: string[] = [];
  for (const message of template.messages) {
    const role = message.role;
    const content = extractMessageContent(message);
    lines.push(`<${role}>${content}</${role}>`);
  }

  return lines.join("\n");
}

/**
 * Extract text content from a prompt message.
 * Handles both string content and array of content parts.
 */
function extractMessageContent(message: PromptMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  // Array of content parts
  const textParts: string[] = [];
  for (const part of message.content as ContentPart[]) {
    if (part.type === "text") {
      textParts.push((part as TextContentPart).text);
    } else if (part.type === "tool_call") {
      const toolCall = part as ToolCallContentPart;
      // tool_call contains name and arguments directly
      textParts.push(
        `[Tool Call: ${toolCall.tool_call.name}(${toolCall.tool_call.arguments})]`
      );
    } else if (part.type === "tool_result") {
      const toolResult = part as ToolResultContentPart;
      // tool_result can be boolean | number | string | object
      const resultStr =
        typeof toolResult.tool_result === "object"
          ? JSON.stringify(toolResult.tool_result)
          : String(toolResult.tool_result);
      textParts.push(`[Tool Result: ${resultStr}]`);
    }
  }

  return textParts.join("\n");
}

function formatPromptPretty(promptVersion: PromptVersion): string {
  const lines = [
    `┌─ Prompt Version: ${promptVersion.id}`,
    `│`,
    `│  Model: ${promptVersion.model_provider} / ${promptVersion.model_name}`,
    `│  Template Type: ${promptVersion.template_type}`,
    `│  Template Format: ${promptVersion.template_format}`,
  ];

  if (promptVersion.description) {
    lines.push(`│  Description: ${promptVersion.description}`);
  }

  lines.push(`│`, `│  Template:`, ...formatPrettyTemplate(promptVersion));
  appendInvocationParameters({ lines, promptVersion });
  appendTools({ lines, promptVersion });
  appendResponseFormat({ lines, promptVersion });
  lines.push(`└─`);
  return lines.join("\n");
}

function formatPrettyTemplate(promptVersion: PromptVersion): string[] {
  const template = promptVersion.template;
  if (template.type === "string") {
    return template.template.split("\n").map((line) => `│    ${line}`);
  }

  return template.messages.flatMap((message) => {
    const role = message.role.toUpperCase();
    const contentLines = extractMessageContent(message).split("\n");
    return [`│    [${role}]`, ...contentLines.map((line) => `│      ${line}`)];
  });
}

function appendInvocationParameters({
  lines,
  promptVersion,
}: {
  lines: string[];
  promptVersion: PromptVersion;
}): void {
  const params = promptVersion.invocation_parameters;
  if (!params) return;

  lines.push(`│`, `│  Invocation Parameters:`);
  const providerParams = params[params.type as keyof typeof params];
  if (!providerParams || typeof providerParams !== "object") return;

  for (const [key, value] of Object.entries(providerParams)) {
    lines.push(`│    ${key}: ${JSON.stringify(value)}`);
  }
}

function appendTools({
  lines,
  promptVersion,
}: {
  lines: string[];
  promptVersion: PromptVersion;
}): void {
  const toolsList = promptVersion.tools?.tools;
  if (!Array.isArray(toolsList) || toolsList.length === 0) return;

  lines.push(`│`, `│  Tools:`);
  appendToolChoice({ lines, promptVersion });
  for (const tool of toolsList) {
    if (tool.type === "function") {
      appendFunctionTool({ lines, tool: tool.function });
    }
  }
}

function appendToolChoice({
  lines,
  promptVersion,
}: {
  lines: string[];
  promptVersion: PromptVersion;
}): void {
  const choice = promptVersion.tools?.tool_choice;
  if (!choice) return;

  const description =
    choice.type === "specific_function"
      ? `${choice.function_name} (required)`
      : choice.type;
  lines.push(`│    Tool Choice: ${description}`);
}

function appendFunctionTool({
  lines,
  tool,
}: {
  lines: string[];
  tool: Extract<
    NonNullable<PromptVersion["tools"]>["tools"][number],
    { type: "function" }
  >["function"];
}): void {
  lines.push(`│`, `│    ┌─ ${tool.name}`);
  if (tool.description) lines.push(`│    │  ${tool.description}`);
  appendFunctionParameters({ lines, parameters: tool.parameters });
  lines.push(`│    └─`);
}

function appendFunctionParameters({
  lines,
  parameters,
}: {
  lines: string[];
  parameters: unknown;
}): void {
  if (!parameters) return;

  lines.push(`│    │`, `│    │  Parameters:`);
  const params = parameters as {
    properties?: Record<
      string,
      { type?: string; description?: string; enum?: string[] }
    >;
    required?: string[];
  };
  if (!params.properties) return;

  const required = params.required || [];
  for (const [propertyName, definition] of Object.entries(params.properties)) {
    const requiredMarker = required.includes(propertyName) ? " (required)" : "";
    const type = definition.type || "any";
    const enumValues = definition.enum?.length
      ? ` [${definition.enum.join(", ")}]`
      : "";
    lines.push(
      `│    │    ${propertyName}: ${type}${enumValues}${requiredMarker}`
    );
    if (definition.description) {
      lines.push(`│    │      └─ ${definition.description}`);
    }
  }
}

function appendResponseFormat({
  lines,
  promptVersion,
}: {
  lines: string[];
  promptVersion: PromptVersion;
}): void {
  if (!promptVersion.response_format) return;
  lines.push(
    `│`,
    `│  Response Format: ${promptVersion.response_format.json_schema.name}`
  );
}
