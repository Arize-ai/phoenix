import { Variables } from "../prompts/sdks/types";
import {
  asTextPart,
  TextPart,
} from "../schemas/llm/phoenixPrompt/messagePartSchemas";
import { PromptChatMessage, PromptTemplateFormat } from "../types/prompts";

import { assertUnreachable } from "./assertUnreachable";

/**
 * Format a list of prompt messages
 *
 * @param format - The format of the prompt message variables, e.g. MUSTACHE, F_STRING, NONE
 * @param promptMessages - The prompt messages to format
 * @param variables - The variables to use in the formatting
 * @returns The formatted prompt messages
 */
export function formatPromptMessages(
  format: PromptTemplateFormat,
  promptMessages: PromptChatMessage[],
  variables: Variables = {}
) {
  const replacements: [RegExp, string][] = [];
  switch (format) {
    case "MUSTACHE": {
      const asMustache = Object.entries(variables).map(([key, value]) => [
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}(?!\\})`, "g"),
        value.toString(),
      ]) satisfies [RegExp, string][];
      replacements.push(...asMustache);
      break;
    }
    case "F_STRING": {
      const asF_STRING = Object.entries(variables).map(([key, value]) => [
        new RegExp(`(?<!\\{)\\{\\s*${key}\\s*\\}(?!\\})`, "g"),
        value.toString(),
      ]) satisfies [RegExp, string][];
      replacements.push(...asF_STRING);
      break;
    }
    case "NONE":
      break;
    default:
      assertUnreachable(format);
  }

  return promptMessages.map((message) => ({
    ...message,
    content:
      typeof message.content == "string"
        ? applyReplacements(message.content, replacements)
        : message.content.map((content) => {
            const textPart = asTextPart(content);
            if (textPart) {
              return {
                ...textPart,
                text: applyReplacements(textPart.text, replacements),
              } satisfies TextPart;
            }
            return content;
          }),
  }));
}

/**
 * Apply a list of replacements to a string
 * @param text - The text to apply the replacements to
 * @param replacements - The replacements to apply
 * @returns The text with the replacements applied
 */
function applyReplacements(
  text: string,
  replacements: [RegExp, string][]
): string {
  let newText = text;
  for (const [key, value] of replacements) {
    newText = newText.replaceAll(key, value);
  }
  return newText;
}
