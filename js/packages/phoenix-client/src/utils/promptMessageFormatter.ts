import { Variables } from "../prompts/sdks/types";
import { PromptChatMessage, PromptTemplateFormat } from "../types/prompts";
import { assertUnreachable } from "./assertUnreachable";
import { TextPart, asTextPart } from "../schemas/llm/promptSchemas";

/**
 * Format a prompt message
 *
 * @param format - The format of the prompt message variables, e.g. MUSTACHE, FSTRING, NONE
 * @param promptMessages - The prompt messages to format
 * @param variables - The variables to use in the formatting
 * @returns The formatted prompt messages
 */
export function promptMessageFormatter(
  format: PromptTemplateFormat,
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
    case "FSTRING": {
      const asFString = Object.entries(variables).map(([key, value]) => [
        new RegExp(`(?<!\\{)\\{${key}\\}(?!\\})`, "g"),
        value.toString(),
      ]) satisfies [RegExp, string][];
      replacements.push(...asFString);
      break;
    }
    case "NONE":
      break;
    default:
      assertUnreachable(format);
  }

  return promptMessages.map((message) => ({
    ...message,
    content: message.content.map((content) => {
      const textPart = asTextPart(content);
      if (textPart) {
        let newText = textPart.text.text;
        const toReplace = [...replacements];
        while (toReplace.length > 0) {
          const [key, value] = toReplace.shift()!;
          newText = newText.replaceAll(key, value);
        }
        return {
          ...textPart,
          text: { text: newText },
        } satisfies TextPart;
      }
      return content;
    }),
  }));
}
