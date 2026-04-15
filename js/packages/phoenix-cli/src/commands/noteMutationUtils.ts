import { InvalidArgumentError } from "../exitCodes";
import { trimToUndefined } from "../normalize";

export type NoteTargetType = "span" | "trace";

export interface NoteMutationResult {
  id: string;
  targetType: NoteTargetType;
  targetId: string;
  text: string;
  annotatorKind: "HUMAN";
}

function getTargetIdPlaceholder({
  targetType,
}: {
  targetType: NoteTargetType;
}): string {
  return targetType === "span" ? "<span-id>" : "<trace-id>";
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
    annotatorKind: "HUMAN",
  };
}
