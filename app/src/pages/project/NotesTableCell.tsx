import { css } from "@emotion/react";
import type { ReactNode } from "react";
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
  gap: var(--global-dimension-size-50);
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

export const noteTooltipLoadingCSS = css`
  /*
   * Approximate the eventual table footprint to minimize horizontal tooltip
   * repositioning when lazy-loaded note details replace the loading state.
   */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 520px;
  padding: var(--global-dimension-size-200);
`;

export type Note = {
  readonly id: string;
  readonly explanation: string | null;
  readonly createdAt: string;
  readonly user?: {
    readonly username: string;
  } | null;
};

type NoteEntry = {
  id: string;
  text: string;
  createdAt: string;
  user?: Note["user"];
};

export function getNoteEntries(
  notes: ReadonlyArray<Note>
): ReadonlyArray<NoteEntry> {
  return notes
    .map((note) => ({
      id: note.id,
      text: note.explanation?.trim() ?? "",
      createdAt: note.createdAt,
      user: note.user,
    }))
    .filter((note) => note.text.length > 0);
}

export function getNoteAuthorName(note: Pick<NoteEntry, "user">) {
  return note.user?.username ?? "system";
}

export function formatNoteCreatedAt(createdAt: string) {
  return new Date(createdAt).toLocaleString();
}

export function NoteTooltipContent({
  notes,
}: {
  notes: ReadonlyArray<NoteEntry>;
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
                <Text color="inherit">{getNoteAuthorName(note)}</Text>
              </td>
              <td>
                <Text color="inherit">
                  {formatNoteCreatedAt(note.createdAt)}
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

export function NotesTableCell({
  noteCount,
  noteLabel,
  tooltipContent,
}: {
  noteCount: number;
  noteLabel: string;
  tooltipContent: ReactNode;
}) {
  const handlePress = useCallback((e: PressEvent) => {
    e.continuePropagation();
  }, []);

  if (noteCount === 0) {
    return <>{"--"}</>;
  }

  return (
    <TooltipTrigger delay={0}>
      <Pressable onPress={handlePress} aria-label={noteLabel}>
        <div css={noteCountTriggerCSS}>
          <Icon svg={<Icons.MessageSquare />} />
          <Text size="S" color="inherit" fontFamily="mono">
            {formatNumber(noteCount)}
          </Text>
        </div>
      </Pressable>
      <RichTooltip placement="bottom" css={noteTooltipCSS} width="auto">
        <TooltipArrow />
        {tooltipContent}
      </RichTooltip>
    </TooltipTrigger>
  );
}
