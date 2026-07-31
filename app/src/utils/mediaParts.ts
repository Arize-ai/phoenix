/**
 * Reading and building the media parts of a prompt message.
 *
 * The `as*` functions discriminate a part structurally rather than by `__typename`,
 * so they work on data that never came through Relay — a template built in a test,
 * or one read from a plain object. The `make*` functions refuse a part with a
 * missing piece rather than storing a half-formed reference.
 */
import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
} from "@phoenix/schemas/mediaPartSchemas";
import {
  filePartSchema,
  fileVariablePartSchema,
  imagePartSchema,
  imageVariablePartSchema,
} from "@phoenix/schemas/mediaPartSchemas";

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
