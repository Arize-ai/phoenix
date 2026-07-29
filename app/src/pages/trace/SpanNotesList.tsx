import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Text, View } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanNotesListQuery } from "./__generated__/SpanNotesListQuery.graphql";

type SpanNotesListProps = {
  spanId: string;
};

/** Fetches the reserved note annotations when the notes section is mounted. */
export function SpanNotesList({ spanId }: SpanNotesListProps) {
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

  return <SpanNotesListContent notes={data.span?.spanNotes ?? []} />;
}

export type SpanNote = {
  id: string;
  explanation: string | null;
  createdAt: string;
  user: { username: string } | null;
};

const notesListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: 0;
  padding: var(--global-dimension-size-100);
  list-style: none;
`;

const noteTextCSS = css`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

export function SpanNotesListContent({
  notes,
}: {
  notes: readonly SpanNote[];
}) {
  const { fullTimeFormatter } = useTimeFormatters();

  if (notes.length === 0) {
    return (
      <Flex
        direction="column"
        alignItems="center"
        paddingX="size-100"
        paddingY="size-400"
      >
        <EmptyState
          graphic={<EmptyStateGraphic variant="note" />}
          description="No notes for this span"
        />
      </Flex>
    );
  }

  return (
    <ul css={notesListCSS}>
      {notes.map((note) => (
        <li key={note.id}>
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
      ))}
    </ul>
  );
}
