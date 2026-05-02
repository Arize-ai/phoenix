import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Loading, Text } from "@phoenix/components";
import { formatNumber } from "@phoenix/utils/numberFormatUtils";

import type { TraceNotesTableCellQuery } from "./__generated__/TraceNotesTableCellQuery.graphql";
import {
  getNoteEntries,
  NoteTooltipContent,
  noteTooltipLoadingCSS,
  NotesTableCell,
} from "./NotesTableCell";

function TraceNoteTooltipDetails({ traceId }: { traceId: string }) {
  const data = useLazyLoadQuery<TraceNotesTableCellQuery>(
    graphql`
      query TraceNotesTableCellQuery($traceId: ID!) {
        trace: node(id: $traceId) {
          __typename
          ... on Trace {
            traceAnnotations(filter: { include: { names: ["note"] } }) {
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
    { traceId }
  );
  const noteEntries =
    data.trace?.__typename === "Trace"
      ? getNoteEntries(data.trace.traceAnnotations)
      : [];

  if (noteEntries.length === 0) {
    return <Text color="inherit">No notes</Text>;
  }

  return <NoteTooltipContent notes={noteEntries} />;
}

export function TraceNotesTableCell({
  noteCount,
  traceId,
}: {
  noteCount: number;
  traceId: string;
}) {
  return (
    <NotesTableCell
      noteCount={noteCount}
      noteLabel={`${formatNumber(noteCount)} trace note${
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
          <TraceNoteTooltipDetails traceId={traceId} />
        </Suspense>
      }
    />
  );
}
