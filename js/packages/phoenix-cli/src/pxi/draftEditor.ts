export type DraftEditorState = {
  value: string;
  cursorIndex: number;
  preferredColumn?: number;
};

export const EMPTY_DRAFT_EDITOR_STATE: DraftEditorState = {
  value: "",
  cursorIndex: 0,
};

function clampCursorIndex({ draft }: { draft: DraftEditorState }): number {
  return Math.min(Math.max(draft.cursorIndex, 0), draft.value.length);
}

export function insertDraftText({
  draft,
  text,
}: {
  draft: DraftEditorState;
  text: string;
}): DraftEditorState {
  const cursorIndex = clampCursorIndex({ draft });
  return {
    value:
      draft.value.slice(0, cursorIndex) + text + draft.value.slice(cursorIndex),
    cursorIndex: cursorIndex + text.length,
  };
}

export function moveDraftCursor({
  draft,
  offset,
}: {
  draft: DraftEditorState;
  offset: number;
}): DraftEditorState {
  return {
    value: draft.value,
    cursorIndex: Math.min(
      Math.max(clampCursorIndex({ draft }) + offset, 0),
      draft.value.length
    ),
  };
}

export function moveDraftCursorToStart({
  draft,
}: {
  draft: DraftEditorState;
}): DraftEditorState {
  return { value: draft.value, cursorIndex: 0 };
}

export function moveDraftCursorToEnd({
  draft,
}: {
  draft: DraftEditorState;
}): DraftEditorState {
  return { value: draft.value, cursorIndex: draft.value.length };
}

export function deleteDraftTextBeforeCursor({
  draft,
}: {
  draft: DraftEditorState;
}): DraftEditorState {
  const cursorIndex = clampCursorIndex({ draft });
  if (cursorIndex === 0) {
    return draft;
  }
  return {
    value:
      draft.value.slice(0, cursorIndex - 1) + draft.value.slice(cursorIndex),
    cursorIndex: cursorIndex - 1,
  };
}

export function deleteDraftTextAtCursor({
  draft,
}: {
  draft: DraftEditorState;
}): DraftEditorState {
  const cursorIndex = clampCursorIndex({ draft });
  if (cursorIndex >= draft.value.length) {
    return draft;
  }
  return {
    value:
      draft.value.slice(0, cursorIndex) + draft.value.slice(cursorIndex + 1),
    cursorIndex,
  };
}

function getDraftLineInfo({ draft }: { draft: DraftEditorState }): {
  lineStartIndex: number;
  lineEndIndex: number;
  column: number;
} {
  const cursorIndex = clampCursorIndex({ draft });
  const lineStartSearchIndex = Math.max(0, cursorIndex - 1);
  const lineStartIndex =
    draft.value.lastIndexOf("\n", lineStartSearchIndex) + 1;
  const nextNewlineIndex = draft.value.indexOf("\n", cursorIndex);
  const lineEndIndex =
    nextNewlineIndex === -1 ? draft.value.length : nextNewlineIndex;
  return {
    lineStartIndex,
    lineEndIndex,
    column: cursorIndex - lineStartIndex,
  };
}

export function moveDraftCursorVertically({
  draft,
  direction,
}: {
  draft: DraftEditorState;
  direction: -1 | 1;
}): DraftEditorState {
  const currentLine = getDraftLineInfo({ draft });
  const preferredColumn = draft.preferredColumn ?? currentLine.column;

  if (direction === -1) {
    if (currentLine.lineStartIndex === 0) {
      return {
        value: draft.value,
        cursorIndex: clampCursorIndex({ draft }),
        preferredColumn,
      };
    }
    const previousLineEndIndex = currentLine.lineStartIndex - 1;
    const previousLineStartIndex =
      draft.value.lastIndexOf("\n", previousLineEndIndex - 1) + 1;
    const previousLineLength = previousLineEndIndex - previousLineStartIndex;
    return {
      value: draft.value,
      cursorIndex:
        previousLineStartIndex + Math.min(preferredColumn, previousLineLength),
      preferredColumn,
    };
  }

  if (currentLine.lineEndIndex >= draft.value.length) {
    return {
      value: draft.value,
      cursorIndex: clampCursorIndex({ draft }),
      preferredColumn,
    };
  }
  const nextLineStartIndex = currentLine.lineEndIndex + 1;
  const nextNewlineIndex = draft.value.indexOf("\n", nextLineStartIndex);
  const nextLineEndIndex =
    nextNewlineIndex === -1 ? draft.value.length : nextNewlineIndex;
  const nextLineLength = nextLineEndIndex - nextLineStartIndex;
  return {
    value: draft.value,
    cursorIndex: nextLineStartIndex + Math.min(preferredColumn, nextLineLength),
    preferredColumn,
  };
}
