import { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { JSONText } from "@phoenix/components/code/JSONText";
import { Icons } from "@phoenix/components/icon";
import { Icon } from "@phoenix/components/icon/Icon";
import { Flex } from "@phoenix/components/layout/Flex";
import { PreformattedTextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { SpanAnnotationActionMenu } from "@phoenix/components/trace/SpanAnnotationActionMenu";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import {
  SpanFeedback_annotations$data,
  SpanFeedback_annotations$key,
} from "./__generated__/SpanFeedback_annotations.graphql";
import { SpanAnnotationsEmpty } from "./SpanAnnotationsEmpty";

type TableRow = SpanFeedback_annotations$data["spanAnnotations"][number] & {
  spanNodeId: string;
};

const spanAnnotationsTableWrapCSS = css`
  overflow: auto;
`;

function SpanAnnotationsTable({
  annotations,
  spanNodeId,
}: {
  annotations: SpanFeedback_annotations$data["spanAnnotations"];
  spanNodeId: string;
}) {
  const tableData = useMemo<TableRow[]>(() => {
    return annotations.map((annotation) => ({
      ...annotation,
      spanNodeId,
    }));
  }, [annotations, spanNodeId]);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

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
          return (
            <SpanAnnotationActionMenu
              buttonVariant="default"
              buttonSize="compact"
              annotationId={row.original.id}
              spanNodeId={row.original.spanNodeId}
              annotationName={row.original.name}
              onSpanAnnotationActionSuccess={notifySuccess}
              onSpanAnnotationActionError={(error) => {
                notifyError({
                  title: "Failed to update span annotation",
                  message: error.message,
                });
              }}
            />
          );
        },
      },
    ],
    [notifyError, notifySuccess]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
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
                          className: header.column.getCanSort()
                            ? "cursor-pointer"
                            : "",
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
  const data = useFragment(
    graphql`
      fragment SpanFeedback_annotations on Span {
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
    span
  );

  const annotations = data.spanAnnotations;

  const hasAnnotations = data.spanAnnotations.length > 0;
  return hasAnnotations ? (
    <SpanAnnotationsTable annotations={annotations} spanNodeId={data.id} />
  ) : (
    <SpanAnnotationsEmpty />
  );
}
