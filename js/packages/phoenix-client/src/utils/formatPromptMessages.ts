import { Variables } from "../prompts/sdks/types";
import { PromptChatMessage, TemplateFormat } from "../types/prompts";
import { assertUnreachable } from "./assertUnreachable";
import {
  TextPart,
  asTextPart,
} from "../schemas/llm/phoenixPrompt/messagePartSchemas";

/**
 * Format a list of prompt messages
 *
 * @param format - The format of the prompt message variables, e.g. MUSTACHE, F_STRING, NONE
 * @param promptMessages - The prompt messages to format
 * @param variables - The variables to use in the formatting
 * @returns The formatted prompt messages
 */
export function formatPromptMessages(
  format: TemplateFormat,
  promptMessages: PromptChatMessage[],
  variables: Variables = {}
) {
  const replacements: [RegExp, string][] = [];
  switch (format) {
    case "MUSTACHE": {
      const asMustache = Object.entries(variables).map(([key, value]) => [
        new RegExp(`\\{\\{${key}\\}\\}(?!\\})`, "g"),
        value.toString(),
      ]) satisfies [RegExp, string][];
      replacements.push(...asMustache);
      break;
    }
    case "F_STRING": {
      const asF_STRING = Object.entries(variables).map(([key, value]) => [
        new RegExp(`(?<!\\{)\\{${key}\\}(?!\\})`, "g"),
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
        ? message.content // TODO: Fix this string substitution
        : message.content.map((content) => {
            const textPart = asTextPart(content);
            if (textPart) {
              let newText = textPart.text;
              const toReplace = [...replacements];
              while (toReplace.length > 0) {
                const [key, value] = toReplace.shift()!;
                newText = newText.replaceAll(key, value);
              }
              return {
                ...textPart,
                text: newText,
              } satisfies TextPart;
            }
            return content;
          }),
  }));
}
