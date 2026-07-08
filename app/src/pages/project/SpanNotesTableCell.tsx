import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Loading, Text } from "@phoenix/components";
import { formatNumber } from "@phoenix/utils/numberFormatUtils";

import type { SpanNotesTableCellQuery } from "./__generated__/SpanNotesTableCellQuery.graphql";
import {
  getNoteEntries,
  NoteTooltipContent,
  noteTooltipLoadingCSS,
  NotesTableCell,
} from "./NotesTableCell";

function SpanNoteTooltipDetails({ spanId }: { spanId: string }) {
  const data = useLazyLoadQuery<SpanNotesTableCellQuery>(
    graphql`
      query SpanNotesTableCellQuery($spanId: ID!) {
        span: node(id: $spanId) {
          __typename
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
    { spanId }
  );
  const noteEntries =
    data.span?.__typename === "Span" ? getNoteEntries(data.span.spanNotes) : [];

  if (noteEntries.length === 0) {
    return <Text color="inherit">No notes</Text>;
  }

  return <NoteTooltipContent notes={noteEntries} />;
}

export function SpanNotesTableCell({
  noteCount,
  spanId,
}: {
  noteCount: number;
  spanId: string;
}) {
  return (
    <NotesTableCell
      noteCount={noteCount}
      noteLabel={`${formatNumber(noteCount)} span note${
        noteCount === 1 ? "" : "s"
      }`}
      tooltipContent={
        <Suspense
          fallback={
            <div css={noteTooltipLoadingCSS}>
              <Loading />
            </div>
          }
        >
          <SpanNoteTooltipDetails spanId={spanId} />
        </Suspense>
      }
    />
  );
}
