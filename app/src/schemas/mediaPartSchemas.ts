/**
 * The media parts a prompt message can carry.
 *
 * Held apart from `promptSchemas` so the media feature reads as one file rather
 * than as additions threaded through the part definitions upstream owns.
 */
import { z } from "zod";

/**
 * An image in a prompt message.
 *
 * `url` is a reference, not something to load directly — media stored in Phoenix
 * uses the `phoenix://media/<sha256>` scheme. Pass it through `resolveMediaUrl`
 * before handing it to the browser.
 */
export const imagePartSchema = z.object({
  image: z.object({
    url: z.string(),
    mediaType: z.string(),
  }),
});

export type ImagePart = z.infer<typeof imagePartSchema>;

/**
 * An image a prompt names rather than stores, supplied when the prompt runs.
 *
 * Lets one prompt run against many images: the template reserves the position and
 * the value arrives with the run's inputs.
 */
export const imageVariablePartSchema = z.object({
  image: z.object({
    variable: z.string(),
  }),
});

export type ImageVariablePart = z.infer<typeof imageVariablePartSchema>;

/**
 * A document in a prompt message — a PDF, as things stand.
 *
 * Distinct from an image part because providers carry documents on their own wire
 * format rather than as image content, and because there is no thumbnail to show.
 * `url` follows the same rules as {@link imagePartSchema}.
 */
export const filePartSchema = z.object({
  file: z.object({
    url: z.string(),
    mediaType: z.string(),
  }),
});

export type FilePart = z.infer<typeof filePartSchema>;

/**
 * A document a prompt names rather than stores, supplied when the prompt runs.
 */
export const fileVariablePartSchema = z.object({
  file: z.object({
    variable: z.string(),
  }),
});

export type FileVariablePart = z.infer<typeof fileVariablePartSchema>;

/**
 * Which kind of media a part or variable holds.
 *
 * Images and documents share storage and resolution but not presentation: an image
 * has a thumbnail, a document has a name.
 */
export type MediaKind = "image" | "file";

/** Any media a prompt message can carry. */
export type MediaPart =
  | ImagePart
  | ImageVariablePart
  | FilePart
  | FileVariablePart;
