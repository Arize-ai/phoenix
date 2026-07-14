import { InvalidArgumentError } from "../exitCodes";
import { trimToUndefined } from "../normalize";

export type NoteTargetType = "span" | "trace" | "session";
export const NOTE_ANNOTATION_NAME = "note";

export interface NoteMutationResult {
  id: string;
  targetType: NoteTargetType;
  targetId: string;
  text: string;
}

function getTargetIdPlaceholder({
  targetType,
}: {
  targetType: NoteTargetType;
}): string {
  switch (targetType) {
    case "span":
      return "<span-id>";
    case "trace":
      return "<trace-id>";
    case "session":
      return "<session-id>";
    default:
      return assertNever(targetType);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported note target type: ${String(value)}`);
}

function getAddNoteUsage({
  targetType,
}: {
  targetType: NoteTargetType;
}): string {
  const targetIdPlaceholder = getTargetIdPlaceholder({ targetType });
  return `px ${targetType} add-note ${targetIdPlaceholder} --text <text>`;
}

export function normalizeNoteText({
  targetType,
  text,
}: {
  targetType: NoteTargetType;
  text?: string;
}): string {
  if (text === undefined) {
    throw new InvalidArgumentError(
      `Missing required flag --text.\n  ${getAddNoteUsage({ targetType })}`
    );
  }

  const normalizedText = trimToUndefined({ value: text });
  if (!normalizedText) {
    throw new InvalidArgumentError(
      `Invalid value for --text: <empty>. Expected non-empty text.\n  ${getAddNoteUsage({ targetType })}`
    );
  }

  return normalizedText;
}

export function buildNoteMutationResult({
  id,
  targetType,
  targetId,
  text,
}: {
  id: string;
  targetType: NoteTargetType;
  targetId: string;
  text: string;
}): NoteMutationResult {
  return {
    id,
    targetType,
    targetId,
    text,
  };
}
