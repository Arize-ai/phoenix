/**
 * Serializes a prompt template (chat or string) into a human-readable text
 * representation suitable for diffing between prompt versions.
 */

import type { PromptVersionDiffView__template$data } from "@phoenix/pages/prompt/__generated__/PromptVersionDiffView__template.graphql";

type Template = PromptVersionDiffView__template$data["template"];

export function promptTemplateToText(template: Template): string {
  if (template.__typename === "PromptStringTemplate") {
    return template.template;
  }
  if (template.__typename === "PromptChatTemplate") {
    return template.messages
      .map((message) => {
        const role = `[${message.role}]`;
        const parts = message.content
          .map((part) => {
            if (part.__typename === "TextContentPart") {
              return part.text.text;
            }
            if (part.__typename === "ToolCallContentPart") {
              const tc = part.toolCall.toolCall;
              return `[tool_call] ${tc.name}(${tc.arguments})`;
            }
            if (part.__typename === "ToolResultContentPart") {
              const result =
                typeof part.toolResult.result === "string"
                  ? part.toolResult.result
                  : JSON.stringify(part.toolResult.result, null, 2);
              return `[tool_result] ${part.toolResult.toolCallId}: ${result}`;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
        return `${role}\n${parts}`;
      })
      .join("\n\n");
  }
  return "";
}
