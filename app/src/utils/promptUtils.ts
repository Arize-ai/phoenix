import { graphql, readInlineData } from "react-relay";

import { getChatRole } from "@phoenix/pages/playground/playgroundUtils";
import {
  findToolCallArguments,
  findToolCallId,
  findToolCallName,
} from "@phoenix/schemas";
import {
  TextPart,
  textPartSchema,
  ToolCallPart,
  toolCallPartSchema,
  ToolResultPart,
  toolResultPartSchema,
} from "@phoenix/schemas/promptSchemas";
import { generateMessageId } from "@phoenix/store";
import type { promptUtils_promptMessages$key } from "@phoenix/utils/__generated__/promptUtils_promptMessages.graphql";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

export const asTextPart = (maybePart: unknown): TextPart | null => {
  const parsed = textPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeTextPart = (text?: string | null) => {
  const optimisticTextPart = { text: { text } };
  const parsed = textPartSchema.safeParse(optimisticTextPart);
  return parsed.success ? parsed.data : null;
};

export const asToolCallPart = (maybePart: unknown): ToolCallPart | null => {
  const parsed = toolCallPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeToolCallPart = (maybeToolCall: unknown) => {
  // detect if maybeToolCall is an object with an id, or a string that can be parsed into an object with an id
  const toolCallId = findToolCallId(maybeToolCall);
  const toolCallName = findToolCallName(maybeToolCall);
  const toolCallArguments = findToolCallArguments(maybeToolCall);
  if (!toolCallId) {
    return null;
  }
  const safelyStringifiedArguments =
    safelyStringifyJSON(toolCallArguments).json || "";
  // then, parse it into the optimistic tool call part shape
  const optimisticToolCallPart: ToolCallPart = {
    toolCall: {
      toolCallId,
      toolCall: {
        name: toolCallName || toolCallId,
        arguments: safelyStringifiedArguments,
      },
    },
  };
  const parsed = toolCallPartSchema.safeParse(optimisticToolCallPart);
  return parsed.success ? parsed.data : null;
};

export const asToolResultPart = (maybePart: unknown): ToolResultPart | null => {
  const parsed = toolResultPartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeToolResultPart = (
  toolCallId?: string | null,
  result?: unknown
) => {
  const optimisticToolResultPart = { toolResult: { toolCallId, result } };
  const parsed = toolResultPartSchema.safeParse(optimisticToolResultPart);
  return parsed.success ? parsed.data : null;
};

export type PromptVersionMessageFragments = Parameters<
  typeof convertPromptVersionMessagesToPlaygroundInstanceMessages
>[0]["promptMessagesRefs"];

/**
 * Converts an array of prompt version message fragments to an array of playground instance message objects.
 * @todo unify this with the fetchPlaygroundPrompt utility. This should nest inside of it, converting all prompt message fields,
 * not just the text content fields.
 * @param promptMessagesRefs - The array of prompt version message fragments.
 * @returns The array of playground instance message objects.
 */
export const convertPromptVersionMessagesToPlaygroundInstanceMessages = ({
  promptMessagesRefs,
}: {
  promptMessagesRefs: Readonly<promptUtils_promptMessages$key[]>;
}) => {
  const promptMessages = promptMessagesRefs.map((message) =>
    readInlineData<promptUtils_promptMessages$key>(
      graphql`
        fragment promptUtils_promptMessages on PromptMessage @inline {
          content {
            ... on TextContentPart {
              text {
                text
              }
            }
          }
          role
        }
      `,
      message
    )
  );

  const instanceMessages = promptMessages.map((message) => ({
    id: generateMessageId(),
    content: message.content
      .map((content) => content.text?.text ?? "")
      .filter(Boolean)
      .join("\n"),
    role: getChatRole(message.role),
  }));

  return instanceMessages;
};
