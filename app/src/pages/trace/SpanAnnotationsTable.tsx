import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import { Alert, Flex } from "@phoenix/components";
import { JSONText } from "@phoenix/components/code/JSONText";
import {
  PreformattedTextCell,
  ResizableTable,
  UserCell,
} from "@phoenix/components/table";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { SpanAnnotationDeleteButton } from "@phoenix/components/trace/SpanAnnotationDeleteButton";
import { NOTE_ANNOTATION_NAME } from "@phoenix/constants/annotationConstants";
import { useNotifySuccess } from "@phoenix/contexts";
import type { NotificationHookParams } from "@phoenix/contexts/NotificationContext";

import type {
  SpanAnnotationsTable_annotations$data,
  SpanAnnotationsTable_annotations$key,
} from "./__generated__/SpanAnnotationsTable_annotations.graphql";
import type { SpanAnnotationsTableQuery } from "./__generated__/SpanAnnotationsTableQuery.graphql";

type SpanAnnotation =
  SpanAnnotationsTable_annotations$data["spanAnnotations"][number];

/** The column the actions menu lives in, pinned to the table's right edge. */
const ACTIONS_COLUMN_ID = "actions";
const PINNED_RIGHT_COLUMN_IDS = [ACTIONS_COLUMN_ID];
const DEFAULT_SORTING = [{ id: "createdAt", desc: true }];

function AnnotationsTable({
  annotations,
  spanNodeId,
  areRowsExpanded,
}: {
  annotations: SpanAnnotation[];
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

  const columns = useMemo<ColumnDef<SpanAnnotation>[]>(
    () => [
      {
        header: "name",
        accessorKey: "name",
        size: 120,
      },
      {
        // "annotator kind" spends a column's width on a word the token below
        // it already says
        header: "kind",
        accessorKey: "annotatorKind",
        size: 100,
        cell: ({ row }) => (
          <AnnotatorKindToken kind={row.original.annotatorKind} />
        ),
      },
      {
        header: "label",
        accessorKey: "label",
        size: 100,
      },
      {
        header: "score",
        accessorKey: "score",
        size: 100,
        // scores are digits, so they read down a shared right edge
        meta: { textAlign: "right" },
      },
      {
        header: "explanation",
        accessorKey: "explanation",
        cell: PreformattedTextCell,
        size: 400,
      },
      {
        header: "user",
        id: "user",
        // the user is an object, which sorts by nothing at all -- the column
        // reads as a name, so it sorts as one
        accessorFn: (annotation) => annotation.user?.username ?? "",
        size: 140,
        cell: ({ row }) => <UserCell user={row.original.user} />,
      },
      {
        header: "source",
        accessorKey: "source",
        size: 100,
      },
      {
        header: "identifier",
        accessorKey: "identifier",
        size: 100,
      },
      {
        header: "metadata",
        accessorKey: "metadata",
        size: 200,
        // there is no order to put arbitrary JSON in, so the header does not
        // offer one
        enableSorting: false,
        cell: ({ row }) => {
          const metadata = row.original.metadata;
          return metadata ? (
            <JSONText json={metadata} collapseSingleKey={false} />
          ) : (
            "--"
          );
        },
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        size: 140,
        cell: TimestampCell,
      },
      {
        header: "updated at",
        accessorKey: "updatedAt",
        size: 140,
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
              annotationName={row.original.name}
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
      columns={columns}
      data={annotations}
      defaultSorting={DEFAULT_SORTING}
      pinnedRightColumnIds={PINNED_RIGHT_COLUMN_IDS}
      areRowsExpanded={areRowsExpanded}
      banner={error ? <Alert variant="danger">{error}</Alert> : null}
      data-testid="span-annotations-table"
    />
  );
}

/**
 * Every annotation attached to a span, in a table that fetches its own data —
 * mount it with a span's node id and a `Suspense` boundary and it needs
 * nothing else from the view around it.
 */
export function SpanAnnotationsTable({
  spanNodeId,
  emptyState,
  areRowsExpanded = false,
}: {
  spanNodeId: string;
  /**
   * Rendered in place of the table when the span has no annotations. Defaults
   * to the table's own empty row, which suits a card or panel that has already
   * named what is missing.
   */
  emptyState?: ReactNode;
  /**
   * Whether a row wraps its content over as many lines as it needs, or is
   * clipped to a single line so the annotations can be scanned down an even
   * grid. Pair with `RowExpandToggleButton` to let the reader switch.
   * @default false
   */
  areRowsExpanded?: boolean;
}) {
  const queryData = useLazyLoadQuery<SpanAnnotationsTableQuery>(
    graphql`
      query SpanAnnotationsTableQuery($id: ID!) {
        span: node(id: $id) {
          ...SpanAnnotationsTable_annotations
        }
      }
    `,
    { id: spanNodeId },
    // the card this sits in unmounts the table whenever it is collapsed or
    // switched away from, and the annotations are written back to the store by
    // every mutation that touches them, so what is already there is current
    { fetchPolicy: "store-or-network" }
  );

  const data = useFragment<SpanAnnotationsTable_annotations$key>(
    graphql`
      fragment SpanAnnotationsTable_annotations on Span {
        id
        spanAnnotations {
          id
          name
          label
          score
          explanation
          metadata
          annotatorKind
          identifier
          source
          createdAt
          updatedAt
          user {
            id
            username
            profilePictureUrl
          }
        }
      }
    `,
    queryData.span
  );

  // Notes are annotations, but they are a conversation rather than a reading
  // of the span, and they have a table of their own. Filtered here rather than
  // in the query because the editor in the aside writes every annotation back
  // to this same record, and a filtered field would not pick up what it adds.
  // Memoized so the table is not handed a new array on every render.
  const spanAnnotations = data?.spanAnnotations;
  const annotations = useMemo(
    () =>
      (spanAnnotations ?? []).filter(
        (annotation) => annotation.name !== NOTE_ANNOTATION_NAME
      ),
    [spanAnnotations]
  );

  if (data == null) {
    throw new Error("Span not found");
  }

  if (annotations.length === 0 && emptyState != null) {
    return emptyState;
  }

  return (
    <AnnotationsTable
      annotations={annotations}
      spanNodeId={data.id}
      areRowsExpanded={areRowsExpanded}
    />
  );
}
