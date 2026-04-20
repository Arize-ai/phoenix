import { css } from "@emotion/react";
import { Pressable } from "react-aria";

import {
  Dialog,
  DialogTrigger,
  Flex,
  Popover,
  PopoverArrow,
  Text,
  View,
} from "@phoenix/components";
import { baseAnnotationLabelCSS } from "@phoenix/components/annotation/AnnotationLabel";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { tableCSS } from "@phoenix/components/table/styles";

const notePillsCSS = css`
  white-space: normal;
  min-width: 0;
`;

const notePillCSS = css(
  baseAnnotationLabelCSS,
  css`
    box-sizing: border-box;
    max-width: 180px;
    min-width: 0;
    align-items: center;
  `
);

const noteTextWrapCSS = css`
  min-width: 0;
`;

const notePopoverCSS = css`
  .react-aria-Dialog {
    padding: 0;
    border-radius: var(--global-rounding-small);
    overflow: hidden;
  }
`;

const noteTableCSS = css(
  tableCSS,
  css`
    thead tr th {
      background-color: transparent;
      padding: var(--global-dimension-size-75) var(--global-dimension-size-100);
    }

    tbody tr td {
      padding: var(--global-dimension-size-75) var(--global-dimension-size-100);
      border-bottom: none;
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
  note,
}: {
  note: Readonly<SpanNoteEntry>;
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
          <tr>
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

  if (noteEntries.length === 0) {
    return <>{"--"}</>;
  }

  return (
    <Flex direction="row" gap="size-50" wrap="wrap" css={notePillsCSS}>
      {noteEntries.map((note) => (
        <DialogTrigger key={note.id}>
          <Pressable>
            <span
              role="button"
              css={css`
                max-width: 100%;
              `}
            >
              <div css={notePillCSS} data-clickable="true">
                <div css={noteTextWrapCSS}>
                  <Truncate maxWidth="150px" title={note.text}>
                    <Text size="S">{note.text}</Text>
                  </Truncate>
                </div>
              </div>
            </span>
          </Pressable>
          <StopPropagation>
            <Popover placement="bottom" css={notePopoverCSS}>
              <PopoverArrow />
              <Dialog>
                <SpanNoteTooltipContent note={note} />
              </Dialog>
            </Popover>
          </StopPropagation>
        </DialogTrigger>
      ))}
    </Flex>
  );
}
