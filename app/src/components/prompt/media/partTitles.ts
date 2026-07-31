/**
 * Titles for the media parts of a prompt message.
 *
 * Held apart from both the card and the media components so that each can import
 * them without importing the other: the card needs them for its default-expanded
 * disclosure keys, and the media components need them for their own headings.
 */
export const MEDIA_PART_TYPE_TITLE = {
  image: "Image",
  imageVariable: "Image Input",
  file: "Document",
  fileVariable: "Document Input",
} as const;
