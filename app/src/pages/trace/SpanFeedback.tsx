import { css } from "@emotion/react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import { JSONText } from "@phoenix/components/code/JSONText";
import { Alert } from "@phoenix/components/core/alert";
import { Icons } from "@phoenix/components/core/icon";
import { Icon } from "@phoenix/components/core/icon/Icon";
import { Flex } from "@phoenix/components/core/layout/Flex";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { PreformattedTextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { SpanAnnotationActionMenu } from "@phoenix/components/trace/SpanAnnotationActionMenu";
import { TraceAnnotationActionMenu } from "@phoenix/components/trace/TraceAnnotationActionMenu";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useNotifySuccess } from "@phoenix/contexts";

import type {
  SpanFeedback_annotations$data,
  SpanFeedback_annotations$key,
} from "./__generated__/SpanFeedback_annotations.graphql";
import { SpanAnnotationsEmpty } from "./SpanAnnotationsEmpty";

type SpanAnnotation = SpanFeedback_annotations$data["spanAnnotations"][number];
type TraceAnnotation =
  SpanFeedback_annotations$data["trace"]["traceAnnotations"][number];

type TableRow =
  | (TraceAnnotation & {
      annotationScope: "trace";
      traceNodeId: string;
      spanNodeId: string;
    })
  | (SpanAnnotation & {
      annotationScope: "span";
      spanNodeId: string;
    });

const spanAnnotationsTableWrapCSS = css`
  overflow: auto;
`;

const sortAnnotationsByCreatedAtDesc = <
  T extends { readonly createdAt: string },
>(
  annotations: readonly T[]
) => {
  return [...annotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

function SpanAnnotationsTable({
  spanAnnotations,
  traceAnnotations,
  spanNodeId,
  traceNodeId,
}: {
  spanAnnotations: SpanFeedback_annotations$data["spanAnnotations"];
  traceAnnotations: SpanFeedback_annotations$data["trace"]["traceAnnotations"];
  spanNodeId: string;
  traceNodeId: string;
}) {
  const tableData = useMemo<TableRow[]>(() => {
    return [
      ...sortAnnotationsByCreatedAtDesc(traceAnnotations).map((annotation) => ({
        ...annotation,
        annotationScope: "trace" as const,
        traceNodeId,
        spanNodeId,
      })),
      ...sortAnnotationsByCreatedAtDesc(spanAnnotations).map((annotation) => ({
        ...annotation,
        annotationScope: "span" as const,
        spanNodeId,
      })),
    ];
  }, [spanAnnotations, spanNodeId, traceAnnotations, traceNodeId]);
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<TableRow>[] = useMemo(
    () => [
      {
        header: "name",
        accessorKey: "name",
        size: 100,
      },
      {
        header: "annotator kind",
        accessorKey: "annotatorKind",
        size: 100,
        cell: ({ row }) => {
          const annotatorKind = row.original.annotatorKind;
          return <AnnotatorKindToken kind={annotatorKind} />;
        },
      },
      {
        header: "user",
        accessorKey: "user",
        size: 100,
        cell: ({ row }) => {
          const user = row.original.user;
          const userName = user?.username || "system";
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <UserPicture
                name={userName}
                profilePictureUrl={user?.profilePictureUrl || null}
                size={18}
              />
              <span>{userName}</span>
            </Flex>
          );
        },
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
      },
      {
        header: "explanation",
        accessorKey: "explanation",
        cell: PreformattedTextCell,
        size: 400,
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
        minSize: 100,
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
        size: 100,
        cell: TimestampCell,
      },
      {
        header: "updated at",
        accessorKey: "updatedAt",
        size: 100,
        cell: TimestampCell,
      },
      {
        header: "",
        accessorKey: "actions",
        size: 100,
        cell: ({ row }) => {
          if (row.original.annotationScope === "trace") {
            return (
              <TraceAnnotationActionMenu
                annotationId={row.original.id}
                traceNodeId={row.original.traceNodeId}
                spanNodeId={row.original.spanNodeId}
                annotationName={row.original.name}
                onTraceAnnotationActionSuccess={notifySuccess}
                onTraceAnnotationActionError={(error) => {
                  setError(error.message);
                }}
              />
            );
          }
          return (
            <SpanAnnotationActionMenu
              annotationId={row.original.id}
              spanNodeId={row.original.spanNodeId}
              annotationName={row.original.name}
              onSpanAnnotationActionSuccess={notifySuccess}
              onSpanAnnotationActionError={(error) => {
                setError(error.message);
              }}
            />
          );
        },
      },
    ],
    [setError, notifySuccess]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <div css={spanAnnotationsTableWrapCSS}>
      {error && <Alert variant="danger">{error}</Alert>}
      <table css={tableCSS} data-testid="span-annotations-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <>
                      <div
                        {...{
                          className: header.column.getCanSort() ? "sort" : "",
                          onClick: header.column.getToggleSortingHandler(),
                          style: {
                            display: "flex",
                            alignItems: "center",
                            left: header.getStart(),
                            width: header.getSize(),
                          },
                        }}
                      >
                        <Truncate maxWidth="100%">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </Truncate>
                        {header.column.getIsSorted() ? (
                          <Icon
                            className="sort-icon"
                            svg={
                              header.column.getIsSorted() === "asc" ? (
                                <Icons.ArrowUpFilled />
                              ) : (
                                <Icons.ArrowDownFilled />
                              )
                            }
                          />
                        ) : null}
                      </div>
                    </>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmpty />
        ) : (
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

export function SpanFeedback({ span }: { span: SpanFeedback_annotations$key }) {
  "use no memo";
  const data = useFragment(
    graphql`
      fragment SpanFeedback_annotations on Span {
        id
        trace {
          id
          traceAnnotations {
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
    span
  );

  const spanAnnotations = data.spanAnnotations;
  const traceAnnotations = data.trace.traceAnnotations;
  const hasAnnotations =
    spanAnnotations.length > 0 || traceAnnotations.length > 0;
  return hasAnnotations ? (
    <SpanAnnotationsTable
      spanAnnotations={spanAnnotations}
      traceAnnotations={traceAnnotations}
      spanNodeId={data.id}
      traceNodeId={data.trace.id}
    />
  ) : (
    <SpanAnnotationsEmpty />
  );
}
