/**
 * One shared `@inline` fragment for the media members of the `ContentPart` union.
 *
 * Five documents load prompt templates and each needs the same twenty-odd lines asking
 * for the image and file members. Spreading one fragment makes that selection
 * impossible to get half-right — a document cannot ask for the image and forget the
 * file — which matters because Relay returns nothing for an unselected union member and
 * its generated type ends in a `"%other"` arm that absorbs the omission silently.
 *
 * The cost is that `@inline` changes how the data is read. Relay stores it under
 * `__fragments` rather than flattening it onto the part:
 *
 *     {"__typename": "FileContentPart",
 *      "__fragments": {"mediaContentPartFragment": {"file": {...}}}}
 *
 * so reading `part.file` directly finds nothing. Everything that consumes one of those
 * five documents therefore has to come through here. {@link readMediaContentPart}
 * narrows a single part; {@link flattenMediaContent} converts a whole content array
 * back to the flat shape, for the converters that also accept objects built by hand and
 * so cannot call `readInlineData` themselves — it throws on anything that did not come
 * from a document spreading this fragment.
 */
import { graphql, readInlineData } from "react-relay";

import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
} from "@phoenix/schemas/mediaPartSchemas";
import type { mediaContentPartFragment$key } from "@phoenix/utils/__generated__/mediaContentPartFragment.graphql";

export const mediaContentPartFragment = graphql`
  fragment mediaContentPartFragment on ContentPart @inline {
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
`;

/** The media a content part carries, or null when it carries none. */
export type MediaContentPart =
  | ImagePart
  | ImageVariablePart
  | FilePart
  | FileVariablePart;

/**
 * Narrow a content part to the media it carries.
 *
 * @param partRef A `content` element from a document spreading
 *   {@link mediaContentPartFragment}.
 * @returns The media part, or null for text, tool calls and tool results.
 */
export function readMediaContentPart(
  partRef: mediaContentPartFragment$key
): MediaContentPart | null {
  const part = readInlineData(mediaContentPartFragment, partRef);
  if (part.image?.__typename === "ImageContentValue") {
    return { image: { url: part.image.url, mediaType: part.image.mediaType } };
  }
  if (part.image?.__typename === "ImageVariableValue") {
    return { image: { variable: part.image.variable } };
  }
  if (part.file?.__typename === "ImageContentValue") {
    return { file: { url: part.file.url, mediaType: part.file.mediaType } };
  }
  if (part.file?.__typename === "ImageVariableValue") {
    return { file: { variable: part.file.variable } };
  }
  return null;
}

/**
 * A content array with its media read back onto each part.
 *
 * The converters that consume these parts also accept templates built by hand — in a
 * test, or from anything that did not come through Relay — so they cannot call
 * `readInlineData` themselves. Flattening at the boundary lets them keep one shape.
 *
 * @param content A `content` array from a document spreading
 *   {@link mediaContentPartFragment}.
 * @returns The same parts, each with its media fields present directly.
 */
export function flattenMediaContent(
  content: readonly unknown[]
): readonly unknown[] {
  return content.map((part) => {
    const media = readMediaContentPart(part as mediaContentPartFragment$key);
    return media === null ? part : { ...(part as object), ...media };
  });
}

/**
 * A whole chat template with its media read back onto every content part.
 *
 * The conversion from a prompt template to playground messages is shared by the Relay
 * paths and by callers holding a plain object, so it reads parts structurally. Handing
 * it a flattened template keeps that one shape.
 *
 * @param template A template from a document spreading
 *   {@link mediaContentPartFragment}.
 */
export function flattenTemplateMedia<T>(template: T): T {
  // Cast rather than constrain: the Relay type is a union of chat and string
  // templates, and only the chat arm has messages. Kept to this one function so no
  // call site has to know.
  const messages = (
    template as {
      messages?: readonly { content?: readonly unknown[] }[] | null;
    }
  )?.messages;
  if (!messages) {
    return template;
  }
  return {
    ...(template as object),
    messages: messages.map((message) => ({
      ...message,
      content: flattenMediaContent(message.content ?? []),
    })),
  } as T;
}
