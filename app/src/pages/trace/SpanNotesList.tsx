import { css, keyframes } from "@emotion/react";
import { useLayoutEffect, useRef } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text, View } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanNotesListQuery } from "./__generated__/SpanNotesListQuery.graphql";

type SpanNotesListProps = {
  newNoteId?: string | null;
  spanId: string;
};

/** Fetches the reserved note annotations when the notes section is mounted. */
export function SpanNotesList({ newNoteId, spanId }: SpanNotesListProps) {
  const data = useLazyLoadQuery<SpanNotesListQuery>(
    graphql`
      query SpanNotesListQuery($id: ID!) {
        span: node(id: $id) {
          ... on Span {
            spanNotes {
              id
              explanation
              createdAt
              user {
                username
              }
            }
          }
        }
      }
    `,
    { id: spanId }
  );

  return (
    <SpanNotesListContent
      newNoteId={newNoteId}
      notes={data.span?.spanNotes ?? []}
    />
  );
}

export type SpanNote = {
  id: string;
  explanation: string | null;
  createdAt: string;
  user: { username: string } | null;
};

const noteFadeInKeyframes = keyframes`
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
`;

const notesListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: 0;
  padding: var(--global-dimension-size-100);
  list-style: none;

  & > li[data-new-note="true"] {
    animation: ${noteFadeInKeyframes} 200ms ease-out both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
`;

const noteTextCSS = css`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const emptyStateCSS = css`
  padding: var(--global-dimension-size-400) var(--global-dimension-size-100);
`;

export function SpanNotesListContent({
  newNoteId,
  notes,
}: {
  newNoteId?: string | null;
  notes: readonly SpanNote[];
}) {
  if (notes.length === 0) {
    return (
      <Flex direction="column" alignItems="center" css={emptyStateCSS}>
        <EmptyState
          graphic={<EmptyStateGraphic variant="note" />}
          description="No notes for this span"
        />
      </Flex>
    );
  }

  return (
    <ul css={notesListCSS}>
      {notes.map((note) => {
        const isNewNote = note.id === newNoteId;
        return (
          <SpanNoteListItem key={note.id} isNewNote={isNewNote} note={note} />
        );
      })}
    </ul>
  );
}

function SpanNoteListItem({
  isNewNote,
  note,
}: {
  isNewNote: boolean;
  note: SpanNote;
}) {
  const noteRef = useRef<HTMLLIElement>(null);
  const { fullTimeFormatter } = useTimeFormatters();

  useLayoutEffect(() => {
    if (!isNewNote) {
      return;
    }
    noteRef.current?.scrollIntoView({ block: "end" });
  }, [isNewNote]);

  return (
    <li ref={noteRef} data-new-note={isNewNote}>
      <View
        padding="size-200"
        borderWidth="thin"
        borderColor="default"
        borderRadius="medium"
      >
        <Flex direction="column" gap="size-100">
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            justifyContent="space-between"
            wrap
          >
            <Text weight="heavy">{note.user?.username ?? "system"}</Text>
            <Text color="text-500" size="XS">
              <time dateTime={note.createdAt}>
                {fullTimeFormatter(new Date(note.createdAt))}
              </time>
            </Text>
          </Flex>
          <Text css={noteTextCSS}>{note.explanation ?? "--"}</Text>
        </Flex>
      </View>
    </li>
  );
}
