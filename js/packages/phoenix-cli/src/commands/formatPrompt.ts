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
  const lines: string[] = [];

  lines.push(`┌─ Prompt Version: ${promptVersion.id}`);
  lines.push(`│`);
  lines.push(
    `│  Model: ${promptVersion.model_provider} / ${promptVersion.model_name}`
  );
  lines.push(`│  Template Type: ${promptVersion.template_type}`);
  lines.push(`│  Template Format: ${promptVersion.template_format}`);

  if (promptVersion.description) {
    lines.push(`│  Description: ${promptVersion.description}`);
  }

  lines.push(`│`);
  lines.push(`│  Template:`);

  const template = promptVersion.template;
  if (template.type === "string") {
    const templateLines = template.template.split("\n");
    for (const line of templateLines) {
      lines.push(`│    ${line}`);
    }
  } else {
    // Chat template
    for (const message of template.messages) {
      const role = message.role.toUpperCase();
      const content = extractMessageContent(message);
      const contentLines = content.split("\n");

      lines.push(`│    [${role}]`);
      for (const line of contentLines) {
        lines.push(`│      ${line}`);
      }
    }
  }

  // Invocation parameters
  if (promptVersion.invocation_parameters) {
    lines.push(`│`);
    lines.push(`│  Invocation Parameters:`);
    const params = promptVersion.invocation_parameters;
    const providerParams = params[params.type as keyof typeof params];
    if (providerParams && typeof providerParams === "object") {
      for (const [key, value] of Object.entries(providerParams)) {
        lines.push(`│    ${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  // Tools
  if (promptVersion.tools && promptVersion.tools.tools.length > 0) {
    lines.push(`│`);
    lines.push(`│  Tools:`);

    // Tool choice
    if (promptVersion.tools.tool_choice) {
      const choice = promptVersion.tools.tool_choice;
      if (choice.type === "specific_function") {
        lines.push(`│    Tool Choice: ${choice.function_name} (required)`);
      } else {
        lines.push(`│    Tool Choice: ${choice.type}`);
      }
    }

    for (const tool of promptVersion.tools.tools) {
      if (tool.type === "function") {
        const fn = tool.function;
        lines.push(`│`);
        lines.push(`│    ┌─ ${fn.name}`);
        if (fn.description) {
          lines.push(`│    │  ${fn.description}`);
        }
        if (fn.parameters) {
          lines.push(`│    │`);
          lines.push(`│    │  Parameters:`);
          const params = fn.parameters as {
            type?: string;
            properties?: Record<
              string,
              { type?: string; description?: string; enum?: string[] }
            >;
            required?: string[];
          };
          if (params.properties) {
            const required = params.required || [];
            for (const [propName, propDef] of Object.entries(
              params.properties
            )) {
              const isRequired = required.includes(propName);
              const reqMarker = isRequired ? " (required)" : "";
              const typeStr = propDef.type || "any";
              const enumStr =
                propDef.enum && propDef.enum.length > 0
                  ? ` [${propDef.enum.join(", ")}]`
                  : "";
              lines.push(`│    │    ${propName}: ${typeStr}${enumStr}${reqMarker}`);
              if (propDef.description) {
                lines.push(`│    │      └─ ${propDef.description}`);
              }
            }
          }
        }
        lines.push(`│    └─`);
      }
    }
  }

  // Response format
  if (promptVersion.response_format) {
    lines.push(`│`);
    lines.push(
      `│  Response Format: ${promptVersion.response_format.json_schema.name}`
    );
  }

  lines.push(`└─`);

  return lines.join("\n");
}
