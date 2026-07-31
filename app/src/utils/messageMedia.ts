/**
 * Grouping a prompt message's content into the media the playground stores.
 *
 * One place that decides which bucket a part belongs in, so the four groups cannot
 * disagree about the same part.
 *
 * Reads structurally, on purpose. An earlier version put the media selection in a
 * shared Relay `@inline` fragment and read it with `readInlineData`. That deduplicated
 * the selection but broke every structural reader: Relay stores `@inline` data under
 * `__fragments`, not flattened onto the part, so `asImagePart` and friends saw no
 * `image` key and silently returned nothing. The documents ask for the media fields
 * inline instead, which keeps one shape for data that arrives from Relay and for data
 * built by hand, and `contentPartSelectionSets.test.ts` is what keeps the five copies
 * of that selection from drifting apart.
 */
import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
} from "@phoenix/schemas/mediaPartSchemas";
import {
  asFilePart,
  asFileVariablePart,
  asImagePart,
  asImageVariablePart,
} from "@phoenix/utils/mediaParts";

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
 * @param content The message's content parts, in any shape the converters accept.
 */
export function readMessageMedia(content: readonly unknown[]): MessageMedia {
  const media: MessageMedia = {
    images: [],
    imageVariables: [],
    files: [],
    fileVariables: [],
  };
  for (const part of content) {
    const image = asImagePart(part);
    if (image) {
      media.images.push(image);
      continue;
    }
    const imageVariable = asImageVariablePart(part);
    if (imageVariable) {
      media.imageVariables.push(imageVariable);
      continue;
    }
    const file = asFilePart(part);
    if (file) {
      media.files.push(file);
      continue;
    }
    const fileVariable = asFileVariablePart(part);
    if (fileVariable) {
      media.fileVariables.push(fileVariable);
    }
  }
  return media;
}
