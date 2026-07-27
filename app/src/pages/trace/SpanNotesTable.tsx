import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert, Flex } from "@phoenix/components";
import {
  PreformattedTextCell,
  ResizableTable,
  UserCell,
} from "@phoenix/components/table";
import { TABLE_DATA_CELL_CLASS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { SpanAnnotationDeleteButton } from "@phoenix/components/trace/SpanAnnotationDeleteButton";
import { NOTE_ANNOTATION_NAME } from "@phoenix/constants/annotationConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import type { NotificationHookParams } from "@phoenix/contexts/NotificationContext";

import type { SpanNotesTableQuery } from "./__generated__/SpanNotesTableQuery.graphql";

type SpanNote = NonNullable<
  NonNullable<SpanNotesTableQuery["response"]["span"]>["spanAnnotations"]
>[number];

/** The column the delete action lives in, pinned to the table's right edge. */
const ACTIONS_COLUMN_ID = "actions";
const PINNED_RIGHT_COLUMN_IDS = [ACTIONS_COLUMN_ID];
const DEFAULT_SORTING = [{ id: "createdAt", desc: true }];

const spanNotesTableCSS = css`
  // a note is prose someone typed, not code -- it only renders in a <pre> so
  // that the line breaks they typed survive
  td.${TABLE_DATA_CELL_CLASS} pre {
    font-family: inherit;
  }
`;

function NotesTable({
  notes,
  spanNodeId,
  areRowsExpanded,
}: {
  notes: SpanNote[];
  spanNodeId: string;
  areRowsExpanded: boolean;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  // a delete that goes through answers the failure the reader is looking at
  const handleDeleteSuccess = useCallback(
    (notifyProps: NotificationHookParams) => {
      setError(null);
      notifySuccess(notifyProps);
    },
    [notifySuccess]
  );

  const columns = useMemo<ColumnDef<SpanNote>[]>(
    () => [
      {
        // first: a note is someone's remark, so who left it comes before it
        header: "user",
        id: "user",
        // the user is an object, which sorts by nothing at all -- the column
        // reads as a name, so it sorts as one
        accessorFn: (note) => note.user?.username ?? "",
        size: 160,
        cell: ({ row }) => <UserCell user={row.original.user} />,
      },
      {
        header: "note",
        accessorKey: "explanation",
        cell: PreformattedTextCell,
        size: 500,
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        // a full timestamp, which wraps to two lines with any less
        size: 190,
        cell: TimestampCell,
      },
      {
        header: "",
        id: ACTIONS_COLUMN_ID,
        // just wide enough for the button plus the cell's own padding
        size: 44,
        enableSorting: false,
        // a fixed-width control; a drag handle on it would only ever add empty
        // space beside the button
        enableResizing: false,
        cell: ({ row }) => (
          <Flex direction="row" justifyContent="center">
            <SpanAnnotationDeleteButton
              annotationId={row.original.id}
              spanNodeId={spanNodeId}
              // every row here is a note, so naming it would only repeat the
              // column header back at the reader
              noun="note"
              onDeleteSuccess={handleDeleteSuccess}
              onDeleteError={(error) => {
                setError(error.message);
              }}
            />
          </Flex>
        ),
      },
    ],
    [spanNodeId, handleDeleteSuccess]
  );

  return (
    <ResizableTable
      css={spanNotesTableCSS}
      columns={columns}
      data={notes}
      defaultSorting={DEFAULT_SORTING}
      pinnedRightColumnIds={PINNED_RIGHT_COLUMN_IDS}
      areRowsExpanded={areRowsExpanded}
      banner={error ? <Alert variant="danger">{error}</Alert> : null}
      data-testid="span-notes-table"
    />
  );
}

/**
 * Every note left on a span, in a table that fetches its own data — mount it
 * with a span's node id and a `Suspense` boundary and it needs nothing else
 * from the view around it.
 */
export function SpanNotesTable({
  spanNodeId,
  emptyState,
  areRowsExpanded = false,
}: {
  spanNodeId: string;
  /**
   * Rendered in place of the table when the span has no notes. Defaults to the
   * table's own empty row, which suits a card or panel that has already named
   * what is missing.
   */
  emptyState?: ReactNode;
  /**
   * Whether a row wraps its note over as many lines as it needs, or is clipped
   * to a single line so the notes can be scanned down an even grid. Pair with
   * `RowExpandToggleButton` to let the reader switch.
   * @default false
   */
  areRowsExpanded?: boolean;
}) {
  const data = useLazyLoadQuery<SpanNotesTableQuery>(
    graphql`
      query SpanNotesTableQuery($spanNodeId: ID!) {
        span: node(id: $spanNodeId) {
          ... on Span {
            id
            spanAnnotations {
              id
              name
              explanation
              createdAt
              user {
                id
                username
                profilePictureUrl
              }
            }
          }
        }
      }
    `,
    { spanNodeId },
    // the card this sits in unmounts the table whenever it is collapsed, and
    // the notes are written back to the store by every mutation that touches
    // them, so what is already there is current
    { fetchPolicy: "store-or-network" }
  );

  // Filtered here rather than in the query: the editor in the aside writes
  // every annotation back to this same record, and a filtered field would not
  // pick up a note added there. Memoized so the table is not handed a new
  // array on every render.
  const spanAnnotations = data.span?.spanAnnotations;
  const notes = useMemo(
    () =>
      (spanAnnotations ?? []).filter(
        (annotation) => annotation.name === NOTE_ANNOTATION_NAME
      ),
    [spanAnnotations]
  );

  if (notes.length === 0 && emptyState != null) {
    return emptyState;
  }

  return (
    <NotesTable
      notes={notes}
      spanNodeId={spanNodeId}
      areRowsExpanded={areRowsExpanded}
    />
  );
}
