/**
 * Shared `@inline` fragment for the media members of the `ContentPart` union.
 *
 * Five documents load prompt templates, and each needs the same twenty-odd lines
 * asking for the image and file members. Copied, those lines drift: a document that
 * omits one silently drops that media from every prompt it loads, and Relay gives
 * no compile-time warning because the generated union type ends in a `"%other"`
 * arm that absorbs the missing member. Spreading one fragment instead makes the
 * selection impossible to get half-right.
 *
 * Consumers spread `...mediaContentPartFragment` inside their `content` selection.
 * Those that read through Relay's generated types call
 * {@link readMediaContentPart} to narrow a part; those that work on plain objects
 * (a template built in a test, say) can keep reading structurally, because an
 * `@inline` fragment leaves its fields on the parent object at runtime.
 */
import { graphql, readInlineData } from "react-relay";

import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
} from "@phoenix/schemas/promptSchemas";
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

/** The media of a message, grouped the way the playground stores it. */
export type MessageMedia = {
  images: ImagePart[];
  imageVariables: ImageVariablePart[];
  files: FilePart[];
  fileVariables: FileVariablePart[];
};

/**
 * Group a message's content into the four media buckets a playground message holds.
 *
 * One pass and one place that decides which bucket a part belongs in, so the four
 * groups cannot disagree about the same part.
 *
 * @param content The message's content, from a document spreading
 *   {@link mediaContentPartFragment}.
 */
export function readMessageMedia(
  content: readonly mediaContentPartFragment$key[]
): MessageMedia {
  const media: MessageMedia = {
    images: [],
    imageVariables: [],
    files: [],
    fileVariables: [],
  };
  for (const partRef of content) {
    // Bucketed from `__typename` rather than by re-inspecting the returned part:
    // an image and an image variable both carry an `image` key, so `"image" in part`
    // cannot tell the four apart, and a key-shape guess would be one refactor away
    // from putting a part in the wrong bucket silently.
    const part = readInlineData(mediaContentPartFragment, partRef);
    if (part.image?.__typename === "ImageContentValue") {
      media.images.push({
        image: { url: part.image.url, mediaType: part.image.mediaType },
      });
    } else if (part.image?.__typename === "ImageVariableValue") {
      media.imageVariables.push({ image: { variable: part.image.variable } });
    } else if (part.file?.__typename === "ImageContentValue") {
      media.files.push({
        file: { url: part.file.url, mediaType: part.file.mediaType },
      });
    } else if (part.file?.__typename === "ImageVariableValue") {
      media.fileVariables.push({ file: { variable: part.file.variable } });
    }
  }
  return media;
}

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
  if (part.image) {
    return part.image.__typename === "ImageVariableValue"
      ? { image: { variable: part.image.variable } }
      : part.image.__typename === "ImageContentValue"
        ? { image: { url: part.image.url, mediaType: part.image.mediaType } }
        : null;
  }
  if (part.file) {
    return part.file.__typename === "ImageVariableValue"
      ? { file: { variable: part.file.variable } }
      : part.file.__typename === "ImageContentValue"
        ? { file: { url: part.file.url, mediaType: part.file.mediaType } }
        : null;
  }
  return null;
}
