import { graphql, readInlineData } from "react-relay";

import { getChatRole } from "@phoenix/pages/playground/playgroundUtils";
import {
  findToolCallArguments,
  findToolCallId,
  findToolCallName,
} from "@phoenix/schemas";
import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "@phoenix/schemas/promptSchemas";
import {
  filePartSchema,
  fileVariablePartSchema,
  imagePartSchema,
  imageVariablePartSchema,
  textPartSchema,
  toolCallPartSchema,
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

export const asImagePart = (maybePart: unknown): ImagePart | null => {
  const parsed = imagePartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const asImageVariablePart = (
  maybePart: unknown
): ImageVariablePart | null => {
  const parsed = imageVariablePartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeImageVariablePart = (variable?: string | null) => {
  const parsed = imageVariablePartSchema.safeParse({ image: { variable } });
  return parsed.success ? parsed.data : null;
};

export const makeImagePart = (
  url?: string | null,
  mediaType?: string | null
) => {
  const optimisticImagePart = { image: { url, mediaType } };
  const parsed = imagePartSchema.safeParse(optimisticImagePart);
  return parsed.success ? parsed.data : null;
};

export const asFilePart = (maybePart: unknown): FilePart | null => {
  const parsed = filePartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const asFileVariablePart = (
  maybePart: unknown
): FileVariablePart | null => {
  const parsed = fileVariablePartSchema.safeParse(maybePart);
  return parsed.success ? parsed.data : null;
};

export const makeFileVariablePart = (variable?: string | null) => {
  const parsed = fileVariablePartSchema.safeParse({ file: { variable } });
  return parsed.success ? parsed.data : null;
};

export const makeFilePart = (
  url?: string | null,
  mediaType?: string | null
) => {
  const parsed = filePartSchema.safeParse({ file: { url, mediaType } });
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
            ... on ImageContentPart {
              image {
                __typename
                ... on ImageContentValue {
                  url
                  mediaType
                }
                ... on ImageVariableValue {
                  variable
                }
              }
            }
            ... on FileContentPart {
              file {
                __typename
                ... on ImageContentValue {
                  url
                  mediaType
                }
                ... on ImageVariableValue {
                  variable
                }
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
    images: message.content
      .map((content) =>
        content.image?.__typename === "ImageContentValue"
          ? makeImagePart(content.image.url, content.image.mediaType)
          : null
      )
      .filter((part): part is ImagePart => part != null),
    imageVariables: message.content
      .map((content) =>
        content.image?.__typename === "ImageVariableValue"
          ? makeImageVariablePart(content.image.variable)
          : null
      )
      .filter((part): part is ImageVariablePart => part != null),
    files: message.content
      .map((content) =>
        content.file?.__typename === "ImageContentValue"
          ? makeFilePart(content.file.url, content.file.mediaType)
          : null
      )
      .filter((part): part is FilePart => part != null),
    fileVariables: message.content
      .map((content) =>
        content.file?.__typename === "ImageVariableValue"
          ? makeFileVariablePart(content.file.variable)
          : null
      )
      .filter((part): part is FileVariablePart => part != null),
    role: getChatRole(message.role),
  }));

  return instanceMessages;
};
