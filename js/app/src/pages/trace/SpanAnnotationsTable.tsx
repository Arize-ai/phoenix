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
        // the user is an object, which sorts by nothing -- sort by the name
        // the column actually shows
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
        // arbitrary JSON has no order to sort in
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
 * Every annotation attached to a span. Fetches its own data, so it needs only a
 * span's node id and a `Suspense` boundary.
 */
export function SpanAnnotationsTable({
  spanNodeId,
  emptyState,
  areRowsExpanded = false,
}: {
  spanNodeId: string;
  /** Replaces the table when the span has no annotations. */
  emptyState?: ReactNode;
  /** @default false */
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
    // every mutation writes annotations back to the store, so the card can
    // remount as often as it collapses without refetching
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

  // Notes have a table of their own. Filtered here rather than in the query:
  // the editor in the aside writes every annotation back to this same record,
  // and a filtered field would not pick up what it adds.
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
