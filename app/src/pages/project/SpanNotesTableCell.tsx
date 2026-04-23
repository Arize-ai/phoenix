import { css } from "@emotion/react";
import { useCallback } from "react";
import type { PressEvent } from "react-aria";
import { Pressable } from "react-aria";

import {
  Icon,
  Icons,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import { formatNumber } from "@phoenix/utils/numberFormatUtils";

const NOTE_TOOLTIP_MAX_WIDTH = "720px";
const NOTE_TOOLTIP_VIEWPORT_GUTTER = "32px";

const noteCountTriggerCSS = css`
  display: inline-flex;
  flex-direction: row;
  gap: var(--global-dimension-static-size-50);
  align-items: center;
  color: var(--global-text-color-900);
  transition: opacity 0.2s;
  &:hover {
    opacity: 0.8;
  }
`;

const noteTooltipCSS = css`
  padding: 0;
  border-radius: var(--global-rounding-small);
  overflow: hidden;
  width: fit-content;
  max-width: min(
    ${NOTE_TOOLTIP_MAX_WIDTH},
    calc(100vw - ${NOTE_TOOLTIP_VIEWPORT_GUTTER})
  );
`;

const noteTableCSS = css(
  tableCSS,
  css`
    thead tr th {
      background-color: transparent;
    }

    tbody tr td {
      border-bottom: none;
      text-align: left;
    }
  `
);

const noteContentCSS = css`
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 220px;
`;

export type SpanNote = {
  id: string;
  explanation: string | null;
  createdAt: string;
  user?: {
    username: string;
  } | null;
};

type SpanNoteEntry = {
  id: string;
  text: string;
  createdAt: string;
  user?: SpanNote["user"];
};

export function getSpanNoteEntries(
  notes: ReadonlyArray<SpanNote>
): ReadonlyArray<SpanNoteEntry> {
  return notes
    .map((note) => ({
      id: note.id,
      text: note.explanation?.trim() ?? "",
      createdAt: note.createdAt,
      user: note.user,
    }))
    .filter((note) => note.text.length > 0);
}

export function getSpanNoteAuthorName(note: Pick<SpanNoteEntry, "user">) {
  return note.user?.username ?? "system";
}

export function formatSpanNoteCreatedAt(createdAt: string) {
  return new Date(createdAt).toLocaleString();
}

export function SpanNoteTooltipContent({
  notes,
}: {
  notes: ReadonlyArray<SpanNoteEntry>;
}) {
  return (
    <View overflow="auto" maxHeight="260px">
      <table css={noteTableCSS}>
        <thead>
          <tr>
            <th>author</th>
            <th>created at</th>
            <th>note</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <tr key={note.id}>
              <td>
                <Text color="inherit">{getSpanNoteAuthorName(note)}</Text>
              </td>
              <td>
                <Text color="inherit">
                  {formatSpanNoteCreatedAt(note.createdAt)}
                </Text>
              </td>
              <td>
                <Text color="inherit" css={noteContentCSS}>
                  {note.text}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}

export function SpanNotesTableCell({
  notes,
}: {
  notes: ReadonlyArray<SpanNote>;
}) {
  const noteEntries = getSpanNoteEntries(notes);
  const noteCount = noteEntries.length;
  const noteCountLabel = `${formatNumber(noteCount)} span note${
    noteCount === 1 ? "" : "s"
  }`;
  const handlePress = useCallback((e: PressEvent) => {
    e.continuePropagation();
  }, []);

  if (noteCount === 0) {
    return <>{"--"}</>;
  }

  return (
    <TooltipTrigger delay={0}>
      <Pressable onPress={handlePress} aria-label={noteCountLabel}>
        <div css={noteCountTriggerCSS}>
          <Icon svg={<Icons.MessageSquareOutline />} />
          <Text size="S" color="inherit" fontFamily="mono">
            {formatNumber(noteCount)}
          </Text>
        </div>
      </Pressable>
      <RichTooltip placement="bottom" css={noteTooltipCSS} width="auto">
        <TooltipArrow />
        <SpanNoteTooltipContent notes={noteEntries} />
      </RichTooltip>
    </TooltipTrigger>
  );
}
