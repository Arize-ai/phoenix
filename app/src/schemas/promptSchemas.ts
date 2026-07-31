import { z } from "zod";

import { jsonLiteralSchema } from "@phoenix/schemas/jsonLiteralSchema";

export const textPartSchema = z.object({
  text: z.object({
    text: z.string(),
  }),
});

export type TextPart = z.infer<typeof textPartSchema>;

export const toolCallPartSchema = z.object({
  toolCall: z.object({
    toolCallId: z.string(),
    toolCall: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  }),
});

export type ToolCallPart = z.infer<typeof toolCallPartSchema>;

export const toolResultPartSchema = z.object({
  toolResult: z.object({
    toolCallId: z.string(),
    result: jsonLiteralSchema,
  }),
});

export type ToolResultPart = z.infer<typeof toolResultPartSchema>;

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

export type AnyPart =
  | TextPart
  | ToolCallPart
  | ToolResultPart
  | ImagePart
  | ImageVariablePart
  | FilePart
  | FileVariablePart;
