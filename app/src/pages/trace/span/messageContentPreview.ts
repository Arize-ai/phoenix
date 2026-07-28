const DEFAULT_MAX_PREVIEW_CHARACTERS = 4_000;
const DEFAULT_MAX_PREVIEW_LINES = 20;

export type MessageContentPreview = {
  content: string;
  isTruncated: boolean;
};

/**
 * Builds a bounded preview without scanning or copying the full message.
 * @param params - Preview parameters.
 * @param params.content - Complete message content.
 * @param params.maxCharacters - Maximum UTF-16 characters to inspect.
 * @param params.maxLines - Maximum newline-delimited lines to include.
 */
export function getMessageContentPreview({
  content,
  maxCharacters = DEFAULT_MAX_PREVIEW_CHARACTERS,
  maxLines = DEFAULT_MAX_PREVIEW_LINES,
}: {
  content: string;
  maxCharacters?: number;
  maxLines?: number;
}): MessageContentPreview {
  const maximumPreviewEnd = Math.min(content.length, maxCharacters);
  let previewEnd = maximumPreviewEnd;
  let lineBreakCount = 0;

  for (let index = 0; index < maximumPreviewEnd; index += 1) {
    if (content.charCodeAt(index) !== 10) continue;
    lineBreakCount += 1;
    if (lineBreakCount === maxLines) {
      previewEnd = index;
      break;
    }
  }

  if (previewEnd >= content.length) {
    return { content, isTruncated: false };
  }

  const finalCharacterCode = content.charCodeAt(previewEnd - 1);
  const nextCharacterCode = content.charCodeAt(previewEnd);
  const endsWithSplitSurrogatePair =
    finalCharacterCode >= 0xd800 &&
    finalCharacterCode <= 0xdbff &&
    nextCharacterCode >= 0xdc00 &&
    nextCharacterCode <= 0xdfff;
  const safePreviewEnd = endsWithSplitSurrogatePair
    ? previewEnd - 1
    : previewEnd;
  const preview = content.slice(0, safePreviewEnd).trimEnd();
  return {
    content: `${preview}\n…`,
    isTruncated: true,
  };
}
